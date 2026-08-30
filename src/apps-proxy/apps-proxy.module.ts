import { Module } from '@nestjs/common';
import { AppsProxyController } from './apps-proxy.controller.js';
import { ShopifyModule } from '../shopify/shopify.module.js';
import { ShopModule } from '../shop/shop.module.js';
import { ReviewModule } from '../review/review.module.js';
import { ReviewImageModule } from '../review-image/review-image.module.js';
import { UploadModule } from '../upload/upload.module.js';

@Module({
  imports: [ShopifyModule, ShopModule, ReviewModule, ReviewImageModule, UploadModule],
  controllers: [AppsProxyController],
})
export class AppsProxyModule {}