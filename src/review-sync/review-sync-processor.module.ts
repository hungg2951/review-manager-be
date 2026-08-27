import { Module } from '@nestjs/common';
import { ReviewSyncQueueModule } from './review-sync-queue.module.js';
import { ReviewSyncProcessor } from './review-sync.processor.js';
import { ReviewModule } from '../review/review.module.js';
import { ReviewImageModule } from '../review-image/review-image.module.js';
import { ShopifyModule } from '../shopify/shopify.module.js';

@Module({
  imports: [ReviewSyncQueueModule, ReviewModule, ReviewImageModule, ShopifyModule],
  providers: [ReviewSyncProcessor],
})
export class ReviewSyncProcessorModule {}