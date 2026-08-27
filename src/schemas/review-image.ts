import { defineTable } from 'src/database/schema';

export const reviewImageTable = defineTable({
  name: 'review_images',
  columns: {
    id: { type: 'uuid', primary: true },
    review_id: {
      type: 'uuid',
      required: true,
      references: { table: 'reviews', column: 'id', onDelete: 'CASCADE' },
    },
    shop_id: {
      type: 'uuid',
      required: true,
      references: { table: 'shops', column: 'id', onDelete: 'CASCADE' },
    },

    url: { type: 'varchar', required: true }, // ảnh gốc lưu ở storage riêng (S3/Cloudinary...)
    position: { type: 'int', required: true, default: 0 },

    // Đồng bộ 1 chiều App -> Shopify Files
    shopify_file_id: { type: 'varchar', nullable: true },
    sync_status: { type: 'varchar', required: true, default: 'not_synced' }, // not_synced | pending | synced | sync_error
    sync_error_message: { type: 'text', nullable: true },

    created_at: { type: 'timestamp', required: true, default: 'now()' },
    updated_at: { type: 'timestamp', required: true, default: 'now()' },
  },
  indexes: [
    { columns: ['shop_id', 'review_id', 'position'] },
    { columns: ['shop_id', 'sync_status'] },
  ],
});
