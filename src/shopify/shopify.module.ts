import { Module } from '@nestjs/common';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopModule } from '../shop/shop.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';

@Module({
  imports: [ShopModule],
  controllers: [ProductController],
  providers: [ShopifyAuthService, ProductService],
  exports: [ShopifyAuthService, ProductService],
})
export class ShopifyModule {}
