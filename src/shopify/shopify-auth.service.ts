import { Injectable } from '@nestjs/common';
import { ShopService } from '../shop/shop.service.js';

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

@Injectable()
export class ShopifyAuthService {
  // Simple in-memory token cache, keyed by shopId, to avoid re-authenticating
  // on every request. Cleared on server restart — fine for this use case since
  // Shopify tokens can just be re-requested.
  private tokenCache = new Map<string, CachedToken>();

  constructor(private readonly shopService: ShopService) {}

  /**
   * Load a shop's credentials from the `shops` table. Throws 404 (via
   * ShopService.findOne) if the shopId doesn't exist.
   */
  private async getShop(shopId: string) {
    return this.shopService.findOne(shopId);
  }

  /**
   * Resolve and sanitize the store domain for a given shop.
   */
  async getStoreDomain(shopId: string): Promise<string> {
    const shop = await this.getShop(shopId);
    const rawDomain = shop.id_shopify || '';
    return rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  /**
   * Resolve the Shopify API version. Kept as a global env var since it's
   * usually the same across all shops, not per-shop data.
   */
  getApiVersion(): string {
    return process.env.SHOPIFY_API_VERSION || '2024-01';
  }

  /**
   * Build the GraphQL Admin API URL for a given shop.
   */
  async getGraphqlUrl(shopId: string): Promise<string> {
    const storeDomain = await this.getStoreDomain(shopId);
    const apiVersion = this.getApiVersion();
    return `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;
  }

  /**
   * Get a valid access token for the given shop, using the cache when
   * possible. Requests a new token via Shopify's Client Credentials Grant
   * flow when there's no cached token or it has expired.
   */
  async getAccessToken(shopId: string): Promise<string> {
    const cached = this.tokenCache.get(shopId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const shop = await this.getShop(shopId);
    const storeDomain = await this.getStoreDomain(shopId);
    const clientId = shop.client_id;
    const clientSecret = shop.secret_key;

    if (!storeDomain || !clientId || !clientSecret) {
      const missing = [
        !storeDomain && 'id_shopify',
        !clientId && 'client_id',
        !clientSecret && 'secret_key',
      ]
        .filter(Boolean)
        .join(', ');
      const msg = `Shop "${shopId}" is missing required field(s): ${missing}`;
      console.error(`[ShopifyAuthService] ${msg}`);
      throw new Error(msg);
    }

    const tokenUrl = `https://${storeDomain}/admin/oauth/access_token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ShopifyAuthService] Failed to obtain access token for shop "${shopId}" (HTTP ${response.status}): ${errorText}`,
        );
        throw new Error(
          `Shopify authentication failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        access_token?: string;
        expires_in?: number; // seconds, if Shopify returns it
      };

      if (!data.access_token) {
        console.error(
          '[ShopifyAuthService] Access token response missing access_token field:',
          data,
        );
        throw new Error('Access token missing from Shopify OAuth response');
      }

      // Cache with a safety margin (subtract 60s) before the token actually
      // expires. Default to 1 hour if Shopify doesn't return expires_in.
      const ttlSeconds = data.expires_in ?? 3600;
      this.tokenCache.set(shopId, {
        token: data.access_token,
        expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
      });

      return data.access_token;
    } catch (error: any) {
      console.error(
        `[ShopifyAuthService] getAccessToken error for shop "${shopId}": ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Manually clear the cached token for a shop (e.g. after updating its
   * client_id/secret_key via the Shop API).
   */
  clearTokenCache(shopId: string): void {
    this.tokenCache.delete(shopId);
  }
}
