// ─── Aggregate export ────────────────────────────────────────────────────────
// Import this array in the runner to sync all tables at once.

import { shopTable } from './shop.schema.js';
import { userTable } from './user.schema.js';
import { refreshTokenTable } from './refresh-token.schema.js';
import { reviewTable } from './review.js';
import { reviewImageTable } from './review-image.js';

import type { TableSchema } from '../database/schema/types.js';

/**
 * All table schemas in the project.
 * Add new schemas here and they will be picked up by the migration runner.
 */
export const allSchemas: TableSchema[] = [
  shopTable,
  userTable,
  refreshTokenTable,
  reviewTable,
  reviewImageTable,
];
