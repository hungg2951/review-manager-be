import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { ShopifyModule } from '../shopify/shopify.module.js';

@Module({
  imports: [ShopifyModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}