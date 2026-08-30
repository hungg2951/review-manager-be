import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ShopService } from '../shop/shop.service.js';

@Injectable()
export class ShopifyOAuthService {
  constructor(private readonly shopService: ShopService) {}

  private get apiKey(): string {
    const value = process.env.SHOPIFY_API_KEY;
    if (!value) throw new Error('Missing env SHOPIFY_API_KEY');
    return value;
  }

  private get apiSecret(): string {
    const value = process.env.SHOPIFY_API_SECRET;
    if (!value) throw new Error('Missing env SHOPIFY_API_SECRET');
    return value;
  }

  private get scopes(): string {
    const value = process.env.SHOPIFY_SCOPES;
    if (!value) throw new Error('Missing env SHOPIFY_SCOPES');
    return value;
  }

  private get appUrl(): string {
    const value = process.env.SHOPIFY_APP_URL;
    if (!value) throw new Error('Missing env SHOPIFY_APP_URL');
    return value.replace(/\/$/, '');
  }

  isValidShopDomain(shop: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
  }

  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  buildAuthorizeUrl(shop: string, state: string): string {
    const redirectUri = `${this.appUrl}/auth/callback`;
    const params = new URLSearchParams({
      client_id: this.apiKey,
      scope: this.scopes,
      redirect_uri: redirectUri,
      state,
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  verifyQueryHmac(query: Record<string, string>): boolean {
    const { hmac, signature, ...rest } = query;
    if (!hmac) return false;

    const message = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key]}`)
      .join('&');

    const generatedHash = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');

    const a = Buffer.from(generatedHash, 'utf8');
    const b = Buffer.from(hmac, 'utf8');

    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  verifyWebhookHmac(rawBody: string | Buffer, hmacHeader: string): boolean {
    const generatedHash = crypto
      .createHmac('sha256', this.apiSecret)
      .update(rawBody)
      .digest('base64');

    const a = Buffer.from(generatedHash, 'utf8');
    const b = Buffer.from(hmacHeader, 'utf8');

    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  async exchangeCodeForToken(
    shop: string,
    code: string,
  ): Promise<{ access_token: string; scope: string }> {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        code,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to exchange code for token (HTTP ${response.status}): ${text}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      scope: string;
    };

    if (!data.access_token) {
      throw new Error('access_token missing from Shopify OAuth response');
    }

    return data;
  }

  async saveShopCredentials(
    shop: string,
    accessToken: string,
    scope: string,
  ): Promise<void> {
    await this.shopService.upsertByShopifyDomain(shop, {
      access_token: accessToken,
      scope,
      is_active: true,
    });
  }

  async deactivateShop(shop: string): Promise<void> {
    await this.shopService.deactivateByShopifyDomain(shop);
  }

  /**
   * Verify chữ ký App Proxy — KHÁC cơ chế verifyQueryHmac (OAuth):
   * không dùng dấu '&' nối, không có tham số 'hmac' mà là 'signature'.
   * Thuật toán: sort key, nối "key=value" liền nhau không dấu phân cách.
   */
  verifyAppProxySignature(query: Record<string, string>): boolean {
    const { signature, ...rest } = query;
    if (!signature) return false;

    const message = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key]}`)
      .join('');

    const generatedHash = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');

    const a = Buffer.from(generatedHash, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
