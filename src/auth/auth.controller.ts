import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from './public.decorator.js';
import { AuthService } from './auth.service.js';

interface LoginDto {
  email: string;
  password: string;
}

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      dto.email,
      dto.password,
    );

    this.setRefreshCookie(res, refreshToken);

    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    this.setRefreshCookie(res, newRefreshToken);

    return { accessToken };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });

    return { success: true };
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }
}
