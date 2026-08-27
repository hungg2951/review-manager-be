import { defineTable } from '../database/schema/define-table.js';

export const shopTable = defineTable({
  name: 'shops',
  columns: {
    id: { type: 'uuid', primary: true },
    name: { type: 'varchar', required: true },
    description: { type: 'text' },
    id_shopify: { type: 'varchar', required: true, unique: true },
    access_token: { type: 'varchar' },
    scope: { type: 'varchar' },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamp', default: 'now()' },
    updated_at: { type: 'timestamp', default: 'now()' },
  },
});
