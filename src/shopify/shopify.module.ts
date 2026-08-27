import { Module } from '@nestjs/common';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopModule } from '../shop/shop.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { ShopifyOAuthService } from './shopify-oauth.service';
import { ShopifyOAuthController } from './shopify-oauth.controller';

@Module({
  imports: [ShopModule],
  controllers: [ProductController, ShopifyOAuthController],
  providers: [ShopifyAuthService, ProductService, ShopifyOAuthService],
  exports: [ShopifyAuthService, ProductService, ShopifyOAuthService],
})
export class ShopifyModule {}
