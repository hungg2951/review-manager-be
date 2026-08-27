import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator.js';
import { ShopifyOAuthService } from '../shopify/shopify-oauth.service.js';

@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly oauthService: ShopifyOAuthService) {}

  /**
   * POST /webhooks/app-uninstalled
   * Shopify gọi khi merchant gỡ cài đặt app. Cần verify HMAC bằng raw body,
   * KHÔNG dùng req.body đã parse JSON (chữ ký tính trên raw bytes).
   */
  @Post('app-uninstalled')
  @HttpCode(200)
  async handleAppUninstalled(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
  ) {
    if (!hmacHeader || !req.rawBody) {
      throw new BadRequestException('Missing HMAC header or raw body');
    }

    const isValid = this.oauthService.verifyWebhookHmac(
      req.rawBody,
      hmacHeader,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (!shopDomain) {
      throw new BadRequestException('Missing shop domain header');
    }

    await this.oauthService.deactivateShop(shopDomain);

    return { received: true };
  }
}