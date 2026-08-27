import { Module } from '@nestjs/common';
import { ReviewSyncQueueModule } from './review-sync-queue.module.js';
import { ReviewSyncProducerService } from './review-sync.producer.js';

@Module({
  imports: [ReviewSyncQueueModule],
  providers: [ReviewSyncProducerService],
  exports: [ReviewSyncProducerService],
})
export class ReviewSyncProducerModule {}