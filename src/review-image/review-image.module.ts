import { Module } from '@nestjs/common';
import { ReviewModule } from '../review/review.module.js';
import { ReviewSyncProducerModule } from '../review-sync/review-sync-producer.module.js';
import { ReviewImageController } from './review-image.controller.js';
import { ReviewImageService } from './review-image.service.js';

@Module({
  imports: [ReviewModule, ReviewSyncProducerModule],
  controllers: [ReviewImageController],
  providers: [ReviewImageService],
  exports: [ReviewImageService],
})
export class ReviewImageModule {}
