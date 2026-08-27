import { defineTable } from '../database/schema/define-table.js';

export const reviewTable = defineTable({
  name: 'reviews',
  columns: {
    id: { type: 'uuid', primary: true },
    shop_id: {
      type: 'uuid',
      required: true,
      references: { table: 'shops', column: 'id', onDelete: 'CASCADE' },
    },

    // Mapping với sản phẩm Shopify (1 review chỉ gắn 1 sản phẩm)
    shopify_product_id: { type: 'varchar', required: true },

    // Nội dung review
    rating: { type: 'int', required: true }, // CHECK 1-5 
    status: { type: 'varchar', required: true, default: 'draft' }, // draft | pending | published | archived
    verified: { type: 'boolean', required: true, default: false },
    author_name: { type: 'varchar', nullable: true },
    author_email: { type: 'varchar', nullable: true },
    title: { type: 'varchar', nullable: true },
    body: { type: 'text', required: true },
    source: { type: 'varchar', required: true, default: 'manual' }, // manual | import

    // Đồng bộ 1 chiều App -> Shopify
    shopify_metaobject_id: { type: 'varchar', nullable: true },
    shopify_metaobject_handle: { type: 'varchar', nullable: true },
    sync_status: { type: 'varchar', required: true, default: 'not_synced' }, // not_synced | pending | synced | sync_error
    sync_error_message: { type: 'text', nullable: true },
    last_synced_at: { type: 'timestamp', nullable: true },

    created_at: { type: 'timestamp', required: true, default: 'now()' },
    updated_at: { type: 'timestamp', required: true, default: 'now()' },
  },
  indexes: [
    { columns: ['shop_id', 'shopify_product_id', 'status'] },
    { columns: ['shop_id', 'status'] },
    { columns: ['shop_id', 'sync_status'] },
  ],
});
