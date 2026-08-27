import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller.js';
import { ReviewService } from './review.service.js';
import { ReviewSyncProducerModule } from '../review-sync/review-sync-producer.module.js';

@Module({
  imports: [ReviewSyncProducerModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}