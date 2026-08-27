import { defineTable } from '../database/schema/define-table.js';

export const shopTable = defineTable({
  name: 'shops',
  columns: {
    id: { type: 'uuid', primary: true },
    name: { type: 'varchar', required: true },
    description: { type: 'text' },
    id_shopify: { type: 'varchar', required: true, unique: true },
    client_id: { type: 'varchar', required: true },
    secret_key: { type: 'varchar', required: true },
    created_at: { type: 'timestamp', default: 'now()' },
    updated_at: { type: 'timestamp', default: 'now()' },
  },
});
