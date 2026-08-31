import { Injectable, NotFoundException } from '@nestjs/common';
import { pool } from '../database/postgres.client.js';
import {
  CreateReviewDto,
  UpdateReviewDto,
  UpdateReviewSyncStateDto,
} from './review.dto.js';
import { ReviewSyncProducerService } from '../review-sync/review-sync.producer.js';

export interface FindAllReviewsQuery {
  shopify_product_id?: string;
  status?: string;
  sync_status?: string;
  page?: string | number;
  limit?: string | number;
}

export interface PaginatedReviews {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ReviewService {
  constructor(private readonly reviewSyncProducer: ReviewSyncProducerService) {}

  /**
   * Get reviews của 1 shop, newest first, phân trang 1 item / trang.
   * shopId luôn bắt buộc — lấy từ @ShopId() decorator ở controller.
   */
  async findAll(
    shopId: string,
    query: FindAllReviewsQuery = {},
  ): Promise<PaginatedReviews> {
    const DEFAULT_PAGE_SIZE = 10;
    const MAX_PAGE_SIZE = 100; // chặn FE truyền limit=999999 làm sập DB

    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(String(query.limit ?? DEFAULT_PAGE_SIZE), 10) ||
          DEFAULT_PAGE_SIZE,
      ),
    );
    const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
    const offset = (page - 1) * pageSize;

    // Build WHERE conditions
    const conditions: string[] = [`"shop_id" = $1`];
    const values: any[] = [shopId];
    let paramIndex = 2;

    if (query.shopify_product_id) {
      conditions.push(`"shopify_product_id" = $${paramIndex}`);
      values.push(query.shopify_product_id);
      paramIndex++;
    }

    if (query.status) {
      conditions.push(`"status" = $${paramIndex}`);
      values.push(query.status);
      paramIndex++;
    }

    if (query.sync_status) {
      conditions.push(`"sync_status" = $${paramIndex}`);
      values.push(query.sync_status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Đếm tổng số bản ghi thoả điều kiện (để FE biết có bao nhiêu trang)
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM "reviews" WHERE ${whereClause}`,
      values,
    );
    const total = countResult.rows[0].count;

    // Lấy đúng 1 bản ghi của trang hiện tại
    const dataResult = await pool.query(
      `SELECT * FROM "reviews"
       WHERE ${whereClause}
       ORDER BY "created_at" DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, pageSize, offset],
    );

    return {
      data: dataResult.rows,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get 1 review theo id, CHỈ nếu thuộc đúng shopId đang gọi. Nếu review tồn
   * tại nhưng thuộc shop khác, vẫn trả 404 (không leak sự tồn tại xuyên tenant).
   */
  async findOne(shopId: string, id: string): Promise<any> {
    const result = await pool.query(
      `SELECT * FROM "reviews" WHERE "id" = $1 AND "shop_id" = $2`,
      [id, shopId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review with id "${id}" not found`);
    }

    return result.rows[0];
  }

  /**
   * Create a new review cho shop hiện tại (shopId từ decorator), sau đó
   * enqueue sync job (metaobjectCreate).
   */
  async create(shopId: string, dto: CreateReviewDto): Promise<any> {
    const result = await pool.query(
      `INSERT INTO "reviews"
        ("shop_id", "shopify_product_id", "rating", "status", "verified",
         "author_name", "author_email", "title", "body", "source", "sync_status")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING *`,
      [
        shopId,
        dto.shopify_product_id,
        dto.rating,
        dto.status ?? 'draft',
        dto.verified ?? false,
        dto.author_name,
        dto.author_email,
        dto.title ?? null,
        dto.body,
        dto.source ?? 'manual',
      ],
    );

    const review = result.rows[0];
    await this.reviewSyncProducer.enqueueSyncReview(shopId, review.id);

    return review;
  }

  /**
   * Update, CHỈ nếu review thuộc đúng shopId đang gọi (WHERE id AND shop_id).
   * Throws 404 nếu không tìm thấy hoặc thuộc shop khác.
   */
  async update(shopId: string, id: string, dto: UpdateReviewDto): Promise<any> {
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

    fields.push(`"sync_status" = 'pending'`);
    fields.push(`"updated_at" = now()`);
    values.push(id, shopId);

    const result = await pool.query(
      `UPDATE "reviews"
       SET ${fields.join(', ')}
       WHERE "id" = $${paramIndex} AND "shop_id" = $${paramIndex + 1}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review with id "${id}" not found`);
    }

    const review = result.rows[0];
    await this.reviewSyncProducer.enqueueSyncReview(shopId, review.id);

    return review;
  }

  /**
   * Update sync state — gọi nội bộ bởi sync worker (không qua HTTP), nên
   * không có khái niệm "shop đang request" ở đây, giữ nguyên chỉ theo id.
   */
  async updateSyncState(
    id: string,
    dto: UpdateReviewSyncStateDto,
  ): Promise<any> {
    const fields: string[] = [`"sync_status" = $1`, `"updated_at" = now()`];
    const values: any[] = [dto.sync_status];
    let paramIndex = 2;

    if (dto.shopify_metaobject_id !== undefined) {
      fields.push(`"shopify_metaobject_id" = $${paramIndex}`);
      values.push(dto.shopify_metaobject_id);
      paramIndex++;
    }

    if (dto.shopify_metaobject_handle !== undefined) {
      fields.push(`"shopify_metaobject_handle" = $${paramIndex}`);
      values.push(dto.shopify_metaobject_handle);
      paramIndex++;
    }

    fields.push(`"sync_error_message" = $${paramIndex}`);
    values.push(dto.sync_error_message ?? null);
    paramIndex++;

    if (dto.sync_status === 'synced') {
      fields.push(`"last_synced_at" = now()`);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE "reviews"
       SET ${fields.join(', ')}
       WHERE "id" = $${paramIndex}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review with id "${id}" not found`);
    }

    return result.rows[0];
  }

  /**
   * Delete, CHỈ nếu review thuộc đúng shopId đang gọi. Enqueue metaobjectDelete
   * nếu đã từng sync. Cascades to review_images ở DB level.
   */
  async remove(
    shopId: string,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const result = await pool.query(
      `DELETE FROM "reviews"
       WHERE "id" = $1 AND "shop_id" = $2
       RETURNING "id", "shop_id", "shopify_metaobject_id", "shopify_product_id"`,
      [id, shopId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Review with id "${id}" not found`);
    }

    const { shopify_metaobject_id, shopify_product_id } = result.rows[0];
    if (shopify_metaobject_id) {
      await this.reviewSyncProducer.enqueueDeleteReview(
        shopId,
        shopify_metaobject_id,
        shopify_product_id,
      );
    }

    return { id, deleted: true };
  }

  /**
   * Resync thủ công — không đổi nội dung, chỉ set lại sync_status = 'pending'
   * và enqueue lại job, dùng khi cần thử sync lại sau lỗi mà không muốn
   * đi qua luồng update() (tránh đổi updated_at/nội dung không cần thiết).
   */
  async resync(shopId: string, id: string): Promise<any> {
    const review = await this.findOne(shopId, id); // 404 nếu không thuộc shop

    const result = await pool.query(
      `UPDATE "reviews"
     SET "sync_status" = 'pending', "sync_error_message" = null, "updated_at" = now()
     WHERE "id" = $1 AND "shop_id" = $2
     RETURNING *`,
      [id, shopId],
    );

    const updated = result.rows[0];
    await this.reviewSyncProducer.enqueueSyncReview(shopId, review.id);

    return updated;
  }
}
