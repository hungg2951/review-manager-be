import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShopifyModule } from './shopify/shopify.module';
import { BullModule } from '@nestjs/bullmq';
import { ShopModule } from './shop/shop.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReviewModule } from './review/review.module';
import { ReviewImageModule } from './review-image/review-image.module';
import { ReviewSyncProcessorModule } from './review-sync/review-sync-processor.module';
import { UploadModule } from './upload/upload.module.js';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppsProxyModule } from './apps-proxy/apps-proxy.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    ShopifyModule,
    ShopModule,
    AuthModule,
    UsersModule,
    ReviewModule,
    ReviewImageModule,
    ReviewSyncProcessorModule,
    UploadModule,
    WebhooksModule,
    AppsProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}