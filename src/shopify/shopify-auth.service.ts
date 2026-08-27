import { Injectable } from '@nestjs/common';
import { ShopService } from '../shop/shop.service.js';

@Injectable()
export class ShopifyAuthService {
  constructor(private readonly shopService: ShopService) {}

  private async getShop(shopId: string) {
    return this.shopService.findOne(shopId);
  }

  /**
   * Resolve và sanitize domain của shop.
   */
  async getStoreDomain(shopId: string): Promise<string> {
    const shop = await this.getShop(shopId);
    const rawDomain = shop.id_shopify || '';
    return rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  /**
   * Resolve Shopify API version. Giữ nguyên như cũ, dùng chung cho mọi shop.
   */
  getApiVersion(): string {
    return process.env.SHOPIFY_API_VERSION || '2024-01';
  }

  /**
   * Build GraphQL Admin API URL cho 1 shop.
   */
  async getGraphqlUrl(shopId: string): Promise<string> {
    const storeDomain = await this.getStoreDomain(shopId);
    const apiVersion = this.getApiVersion();
    return `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;
  }

  /**
   * Trả về access token đã lưu sẵn từ lúc OAuth callback (permanent token,
   * không có hạn — chỉ mất hiệu lực khi merchant gỡ app hoặc revoke thủ công).
   * Khác hẳn cơ chế cũ (Client Credentials Grant) — không cần cache TTL,
   * không cần xin lại token mỗi giờ.
   */
  async getAccessToken(shopId: string): Promise<string> {
    const shop = await this.getShop(shopId);

    if (!shop.access_token) {
      throw new Error(
        `Shop "${shopId}" chưa có access_token — app có thể chưa được cài đặt qua OAuth`,
      );
    }

    if (shop.is_active === false) {
      throw new Error(`Shop "${shopId}" đã gỡ cài đặt app (is_active = false)`);
    }

    return shop.access_token;
  }
}
