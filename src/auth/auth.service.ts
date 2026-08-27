import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { pool } from '../database/postgres.client.js';
import { UsersService } from '../users/users.service.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validate email/password and issue a new access + refresh token pair.
   */
  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string | null };
  }> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      // Same error for "no such user" and "wrong password" — avoids leaking
      // which emails are registered.
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.signAccessToken(user.id, user.email, user.name);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Exchange a valid, unexpired refresh token for a new access token AND a
   * new rotated refresh token (the old one is invalidated).
   */
  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    const result = await pool.query(
      `SELECT id, user_id, expires_at FROM "refresh_tokens" WHERE "token_hash" = $1`,
      [tokenHash],
    );

    const stored = result.rows[0];

    if (!stored || new Date(stored.expires_at) < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(stored.user_id);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Rotate: delete the old refresh token, issue a new one.
    await pool.query(`DELETE FROM "refresh_tokens" WHERE "id" = $1`, [
      stored.id,
    ]);

    // Refresh cũng lấy name mới nhất từ DB tại đây -> nếu user vừa đổi tên,
    // token mới phát hành sẽ cập nhật theo, kể cả không cần login lại.
    const accessToken = this.signAccessToken(user.id, user.email, user.name);
    const newRefreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Revoke a refresh token (e.g. on logout).
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    await pool.query(`DELETE FROM "refresh_tokens" WHERE "token_hash" = $1`, [
      tokenHash,
    ]);
  }

  /**
   * name được nhúng thẳng vào access token để các nơi cần author info
   * (vd tạo review) đọc được ngay từ @CurrentUser() mà không cần query DB
   * lại. Đánh đổi: nếu user đổi "name" giữa lúc token còn hạn (mặc định 15
   * phút), token đang dùng vẫn mang tên cũ tới khi refresh/login lại — chấp
   * nhận được vì access token sống rất ngắn.
   */
  private signAccessToken(
    userId: string,
    email: string,
    name: string | null,
  ): string {
    return this.jwtService.sign(
      { sub: userId, email, name },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any,
      },
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    // Opaque random token — not a JWT. Simpler and avoids needing to verify
    // signatures for a token whose only job is to be looked up in the DB.
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashRefreshToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await pool.query(
      `INSERT INTO "refresh_tokens" ("id", "user_id", "token_hash", "expires_at")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, tokenHash, expiresAt],
    );

    return rawToken;
  }

  private hashRefreshToken(rawToken: string): string {
    // SHA-256 is fine here (not bcrypt) — this hash only needs to prevent
    // DB-dump readability, not resist brute force on a low-entropy secret;
    // the raw token itself already has 48 random bytes of entropy.
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
