import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { pool } from '../database/postgres.client.js';

export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
}

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  /**
   * Create a new user. Throws 409 if the email is already taken.
   * Never returns password_hash to the caller.
   */
  async create(dto: CreateUserDto): Promise<{
    id: string;
    email: string;
    name: string | null;
  }> {
    const existing = await pool.query(
      `SELECT id FROM "users" WHERE "email" = $1`,
      [dto.email],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException(
        `A user with email "${dto.email}" already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO "users" ("email", "password_hash", "name")
       VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [dto.email, passwordHash, dto.name ?? null],
    );

    return result.rows[0];
  }

  /**
   * Find a user by email, including the password hash — used internally
   * by AuthService for login. Never expose this row directly to clients.
   */
  async findByEmailWithPassword(email: string): Promise<{
    id: string;
    email: string;
    password_hash: string;
    name: string | null;
  } | null> {
    const result = await pool.query(
      `SELECT id, email, password_hash, name FROM "users" WHERE "email" = $1`,
      [email],
    );

    return result.rows[0] || null;
  }

  async findById(id: string): Promise<{
    id: string;
    email: string;
    name: string | null;
  } | null> {
    const result = await pool.query(
      `SELECT id, email, name FROM "users" WHERE "id" = $1`,
      [id],
    );

    return result.rows[0] || null;
  }
}
