import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { UsersService } from './users.service.js';
import type { CreateUserDto } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users
   * Headers: x-admin-secret: <ADMIN_SECRET from .env>
   * Body: { email, password, name? }
   *
   * Public (bypasses the JWT guard) since there's no logged-in user yet the
   * very first time an account is created — protected instead by a shared
   * secret so random internet traffic can't create accounts. Intended to be
   * called from Postman only, not from the frontend.
   */
  @Public()
  @Post()
  async create(
    @Headers('x-admin-secret') adminSecret: string,
    @Body() dto: CreateUserDto,
  ) {
    const expectedSecret = process.env.ADMIN_SECRET;

    if (!expectedSecret) {
      throw new Error('Missing required environment variable: ADMIN_SECRET');
    }

    if (adminSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid admin secret');
    }

    return this.usersService.create(dto);
  }
}
