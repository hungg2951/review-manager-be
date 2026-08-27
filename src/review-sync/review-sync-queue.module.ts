import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REVIEW_SYNC_QUEUE } from './review-sync.constants';

@Module({
  imports: [BullModule.registerQueue({ name: REVIEW_SYNC_QUEUE })],
  exports: [BullModule],
})
export class ReviewSyncQueueModule {}