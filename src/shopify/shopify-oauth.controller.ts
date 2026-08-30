import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ShopifyOAuthService } from './shopify-oauth.service.js';
import { Public } from '../auth/public.decorator.js';

@Public()
@Controller('auth')
export class ShopifyOAuthController {
  constructor(private readonly oauthService: ShopifyOAuthService) {}

  /**
   * GET /auth/install?shop=xxx.myshopify.com
   * Merchant bấm link cài đặt sẽ vào đây trước, sau đó được redirect
   * sang trang cấp quyền của Shopify.
   */
  @Get('install')
  async install(@Query('shop') shop: string, @Res() res: Response) {
    if (!shop || !this.oauthService.isValidShopDomain(shop)) {
      throw new BadRequestException('Invalid or missing "shop" parameter');
    }

    const state = this.oauthService.generateState();

    // Lưu state tạm vào cookie ký (signed) để verify lại ở bước callback,
    // chống CSRF. Cookie sống ngắn (5 phút) vì chỉ dùng qua giữa 2 bước.
    res.cookie('shopify_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });

    const authorizeUrl = this.oauthService.buildAuthorizeUrl(shop, state);
    return res.redirect(authorizeUrl);
  }

  /**
   * GET /auth/callback?shop=&code=&state=&hmac=...
   * Shopify redirect về đây sau khi merchant bấm "Install app" và cấp quyền.
   */
  @Get('callback')
  async callback(@Query() query: Record<string, string>, @Res() res: Response) {
    const { shop, code, state } = query;

    if (!shop || !this.oauthService.isValidShopDomain(shop)) {
      throw new BadRequestException('Invalid or missing "shop" parameter');
    }
    if (!code) {
      throw new BadRequestException('Missing "code" parameter');
    }

    if (!this.oauthService.verifyQueryHmac(query)) {
      throw new BadRequestException('Invalid HMAC signature');
    }

    const cookieState = res.req.cookies?.['shopify_oauth_state'];
    if (!state || !cookieState || state !== cookieState) {
      throw new BadRequestException('Invalid or missing state (possible CSRF)');
    }
    res.clearCookie('shopify_oauth_state');

    const { access_token, scope } = await this.oauthService.exchangeCodeForToken(
      shop,
      code,
    );

    await this.oauthService.saveShopCredentials(shop, access_token, scope);

    // Redirect merchant vào app UI (embedded admin) sau khi cài xong
    return res.redirect(process.env.FRONTEND_URL || 'https://your-frontend-domain.com');
  }
}