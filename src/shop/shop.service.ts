import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShopDto, UpdateShopDto } from './shop.dto.js';
import { pool } from '../database/postgres.client.js';

@Injectable()
export class ShopService {
  /**
   * Get all shops, newest first.
   */
  async findAll(): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM "shops" ORDER BY "created_at" DESC`,
    );

    return result.rows;
  }

  /**
   * Get a single shop by id. Throws 404 if not found.
   */
  async findOne(id: string): Promise<any> {
    const result = await pool.query(`SELECT * FROM "shops" WHERE "id" = $1`, [
      id,
    ]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Shop with id "${id}" not found`);
    }

    return result.rows[0];
  }

  /**
   * Create a new shop.
   */
  async create(dto: CreateShopDto): Promise<any> {
    const result = await pool.query(
      `INSERT INTO "shops"
        ("name", "description", "id_shopify")
       VALUES ($1, $2, $3)
       RETURNING *`,
      [dto.name, dto.description ?? null, dto.id_shopify],
    );

    return result.rows[0];
  }

  /**
   * Update an existing shop. Only provided fields are updated.
   * Throws 404 if not found.
   */
  async update(id: string, dto: UpdateShopDto): Promise<any> {
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
      // Nothing to update, just return the current row (also verifies existence).
      return this.findOne(id);
    }

    fields.push(`"updated_at" = now()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE "shops"
       SET ${fields.join(', ')}
       WHERE "id" = $${paramIndex}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Shop with id "${id}" not found`);
    }

    return result.rows[0];
  }

  /**
   * Delete a shop. Throws 404 if not found.
   */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const result = await pool.query(
      `DELETE FROM "shops" WHERE "id" = $1 RETURNING "id"`,
      [id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Shop with id "${id}" not found`);
    }

    return { id, deleted: true };
  }

  /**
   * Dùng bởi OAuth callback — tạo shop mới nếu lần đầu cài, cập nhật token
   * nếu shop đã tồn tại (merchant gỡ rồi cài lại).
   */
  async upsertByShopifyDomain(
    shopifyDomain: string,
    data: { access_token: string; scope: string; is_active: boolean },
  ): Promise<any> {
    const existing = await pool.query(
      `SELECT id FROM "shops" WHERE "id_shopify" = $1`,
      [shopifyDomain],
    );

    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE "shops"
       SET "access_token" = $1, "scope" = $2, "is_active" = $3, "updated_at" = now()
       WHERE "id_shopify" = $4
       RETURNING *`,
        [data.access_token, data.scope, data.is_active, shopifyDomain],
      );
      return result.rows[0];
    }

    const result = await pool.query(
      `INSERT INTO "shops" ("id", "name", "id_shopify", "access_token", "scope", "is_active")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING *`,
      [
        shopifyDomain,
        shopifyDomain,
        data.access_token,
        data.scope,
        data.is_active,
      ],
    );
    return result.rows[0];
  }

  /**
   * Dùng bởi webhook app/uninstalled — đánh dấu shop ngừng hoạt động thay vì
   * xoá hẳn, để giữ lại lịch sử review/dữ liệu cũ.
   */
  async deactivateByShopifyDomain(shopifyDomain: string): Promise<void> {
    await pool.query(
      `UPDATE "shops" SET "is_active" = false, "updated_at" = now()
     WHERE "id_shopify" = $1`,
      [shopifyDomain],
    );
  }
}
