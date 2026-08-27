import { defineTable } from '../database/schema/define-table.js';

export const refreshTokenTable = defineTable({
  name: 'refresh_tokens',
  columns: {
    id: { type: 'uuid', primary: true },
    user_id: { type: 'uuid', required: true },
    token_hash: { type: 'varchar', required: true },
    expires_at: { type: 'timestamp', required: true },
    created_at: { type: 'timestamp', default: 'now()' },
  },
});
