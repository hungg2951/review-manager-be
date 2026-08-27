import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  REVIEW_SYNC_JOB_OPTIONS,
  REVIEW_SYNC_QUEUE,
  ReviewSyncJobName,
} from './review-sync.constants.js';
import type {
  DeleteImageJobData,
  DeleteReviewJobData,
  SyncImageJobData,
  SyncReviewJobData,
} from './review-sync.types.js';

@Injectable()
export class ReviewSyncProducerService {
  constructor(@InjectQueue(REVIEW_SYNC_QUEUE) private readonly queue: Queue) {}

  /** Gọi sau khi tạo hoặc update nội dung review (metaobjectCreate/Update). */
  async enqueueSyncReview(shopId: string, reviewId: string): Promise<void> {
    const data: SyncReviewJobData = { shopId, reviewId };
    await this.queue.add(
      ReviewSyncJobName.SYNC_REVIEW,
      data,
      REVIEW_SYNC_JOB_OPTIONS,
    );
  }

  /**
   * Gọi sau khi đã xoá review khỏi DB — cần truyền sẵn shopId + metaobjectId
   * và shopifyProductId (để gỡ id review khỏi metafield "reviews" trên product)
   * * vì lúc worker chạy, row DB đã không còn để tra cứu lại.
   *
   */
  async enqueueDeleteReview(
    shopId: string,
    shopifyMetaobjectId: string,
    shopifyProductId: string,
  ): Promise<void> {
    const data: DeleteReviewJobData = {
      shopId,
      shopifyMetaobjectId,
      shopifyProductId,
    };
    await this.queue.add(
      ReviewSyncJobName.DELETE_REVIEW,
      data,
      REVIEW_SYNC_JOB_OPTIONS,
    );
  }

  /** Gọi sau khi tạo hoặc đổi url ảnh (cần upload lại lên Shopify Files). */
  async enqueueSyncImage(shopId: string, imageId: string): Promise<void> {
    const data: SyncImageJobData = { shopId, imageId };
    await this.queue.add(
      ReviewSyncJobName.SYNC_IMAGE,
      data,
      REVIEW_SYNC_JOB_OPTIONS,
    );
  }

  /** Gọi sau khi đã xoá ảnh khỏi DB — tương tự enqueueDeleteReview. */
  async enqueueDeleteImage(
    shopId: string,
    shopifyFileId: string,
  ): Promise<void> {
    const data: DeleteImageJobData = { shopId, shopifyFileId };
    await this.queue.add(
      ReviewSyncJobName.DELETE_IMAGE,
      data,
      REVIEW_SYNC_JOB_OPTIONS,
    );
  }
}
