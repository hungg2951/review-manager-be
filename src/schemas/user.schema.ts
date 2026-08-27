import { defineTable } from '../database/schema/define-table.js';

export const userTable = defineTable({
  name: 'users',
  columns: {
    id: { type: 'uuid', primary: true },
    email: { type: 'varchar', required: true, unique: true },
    password_hash: { type: 'varchar', required: true },
    name: { type: 'varchar' },
    created_at: { type: 'timestamp', default: 'now()' },
    updated_at: { type: 'timestamp', default: 'now()' },
  },
});
