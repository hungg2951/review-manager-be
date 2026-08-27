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
        ("name", "description", "id_shopify", "client_id", "secret_key")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        dto.name,
        dto.description ?? null,
        dto.id_shopify,
        dto.client_id,
        dto.secret_key,
      ],
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
}
