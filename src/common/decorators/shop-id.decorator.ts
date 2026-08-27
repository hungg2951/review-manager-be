import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

/**
 * Extracts the `x-shop-id` header from the incoming request.
 * Usage: async findAll(@ShopId() shopId: string) { ... }
 * Throws 400 if the header is missing or empty.
 */
export const ShopId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const shopId = request.headers['x-shop-id'];

    if (!shopId || typeof shopId !== 'string') {
      throw new BadRequestException(
        'Missing required "x-shop-id" header',
      );
    }

    return shopId;
  },
);