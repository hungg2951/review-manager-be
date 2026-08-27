import { Injectable, NotFoundException } from '@nestjs/common';
import { pool } from '../database/postgres.client.js';
import { ReviewService } from '../review/review.service.js';
import { ReviewSyncProducerService } from '../review-sync/review-sync.producer.js';
import {
  CreateReviewImageDto,
  ReorderReviewImagesDto,
  UpdateReviewImageDto,
  UpdateReviewImageSyncStateDto,
} from './review-image.dto.js';

@Injectable()
export class ReviewImageService {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewSyncProducer: ReviewSyncProducerService,
  ) {}

  /**
   * Get all images của 1 review — verify review thuộc đúng shopId trước
   * (throws 404 nếu không, kể cả khi review tồn tại nhưng thuộc shop khác).
   */
  async findAllByReview(shopId: string, reviewId: string): Promise<any[]> {
    await this.reviewService.findOne(shopId, reviewId); // 404 nếu không thuộc shop

    const result = await pool.query(
      `SELECT * FROM "review_images" WHERE "review_id" = $1 AND "shop_id" = $2 ORDER BY "position" ASC`,
      [reviewId, shopId],
    );

    return result.rows;
  }

  /**
   * Get 1 ảnh theo id, CHỈ nếu thuộc đúng shopId đang gọi.
   */
  async findOne(shopId: string, id: string): Promise<any> {
    const result = await pool.query(
      `SELECT * FROM "review_images" WHERE "id" = $1 AND "shop_id" = $2`,
      [id, shopId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review image with id "${id}" not found`);
    }

    return result.rows[0];
  }

  /**
   * Create a new image dưới 1 review — verify review thuộc đúng shopId
   * trước khi cho thêm ảnh, rồi enqueue upload job.
   */
  async create(
    shopId: string,
    reviewId: string,
    dto: CreateReviewImageDto,
  ): Promise<any> {
    const review = await this.reviewService.findOne(shopId, reviewId); // 404 nếu không thuộc shop

    let position = dto.position;
    if (position === undefined) {
      const maxPositionResult = await pool.query(
        `SELECT COALESCE(MAX("position"), -1) + 1 AS "next_position"
         FROM "review_images" WHERE "review_id" = $1`,
        [reviewId],
      );
      position = maxPositionResult.rows[0].next_position;
    }

    const result = await pool.query(
      `INSERT INTO "review_images"
        ("review_id", "shop_id", "url", "position")
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [reviewId, review.shop_id, dto.url, position],
    );

    const image = result.rows[0];
    await this.reviewSyncProducer.enqueueSyncImage(shopId, image.id);

    return image;
  }

  /**
   * Update ảnh, CHỈ nếu thuộc đúng shopId đang gọi. Re-enqueue upload chỉ
   * khi url thực sự đổi (cần upload lại).
   */
  async update(
    shopId: string,
    id: string,
    dto: UpdateReviewImageDto,
  ): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      fields.push(`"${key}" = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (fields.length === 0) {
      return this.findOne(shopId, id);
    }

    const urlChanged = dto.url !== undefined;
    if (urlChanged) {
      fields.push(`"sync_status" = 'pending'`);
    }
    fields.push(`"updated_at" = now()`);
    values.push(id, shopId);

    const result = await pool.query(
      `UPDATE "review_images"
       SET ${fields.join(', ')}
       WHERE "id" = $${paramIndex} AND "shop_id" = $${paramIndex + 1}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review image with id "${id}" not found`);
    }

    const image = result.rows[0];
    if (urlChanged) {
      await this.reviewSyncProducer.enqueueSyncImage(shopId, image.id);
    }

    return image;
  }

  /**
   * Update sync state — gọi nội bộ bởi sync worker, không qua HTTP nên
   * không có shopId của "request", giữ nguyên chỉ theo id.
   */
  async updateSyncState(
    id: string,
    dto: UpdateReviewImageSyncStateDto,
  ): Promise<any> {
    const result = await pool.query(
      `UPDATE "review_images"
       SET "sync_status" = $1,
           "shopify_file_id" = COALESCE($2, "shopify_file_id"),
           "sync_error_message" = $3,
           "updated_at" = now()
       WHERE "id" = $4
       RETURNING *`,
      [
        dto.sync_status,
        dto.shopify_file_id ?? null,
        dto.sync_error_message ?? null,
        id,
      ],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review image with id "${id}" not found`);
    }

    return result.rows[0];
  }

  /**
   * Reorder — verify review thuộc đúng shopId trước, rồi chỉ update các ảnh
   * thực sự thuộc review đó (WHERE review_id + shop_id) để tránh 1 request
   * reorder trỏ id ảnh của review/shop khác.
   */
  async reorder(
    shopId: string,
    reviewId: string,
    dto: ReorderReviewImagesDto,
  ): Promise<any[]> {
    await this.reviewService.findOne(shopId, reviewId); // 404 nếu không thuộc shop

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < dto.ordered_ids.length; i++) {
        await client.query(
          `UPDATE "review_images"
           SET "position" = $1, "updated_at" = now()
           WHERE "id" = $2 AND "review_id" = $3 AND "shop_id" = $4`,
          [i, dto.ordered_ids[i], reviewId, shopId],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.findAllByReview(shopId, reviewId);
  }

  /**
   * Delete ảnh, CHỈ nếu thuộc đúng shopId đang gọi. Enqueue fileDelete +
   * re-sync review cha nếu ảnh đã từng sync lên Shopify.
   */
  async remove(
    shopId: string,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const result = await pool.query(
      `DELETE FROM "review_images"
       WHERE "id" = $1 AND "shop_id" = $2
       RETURNING "id", "review_id", "shopify_file_id"`,
      [id, shopId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review image with id "${id}" not found`);
    }

    const { review_id, shopify_file_id } = result.rows[0];

    if (shopify_file_id) {
      await this.reviewSyncProducer.enqueueDeleteImage(shopId, shopify_file_id);
      // Refresh field images trên metaobject review cha để bỏ ảnh vừa xoá
      await this.reviewSyncProducer.enqueueSyncReview(shopId, review_id);
    }

    return { id, deleted: true };
  }
}
