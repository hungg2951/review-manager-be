/**
 * Database Migration Runner
 *
 * Connects to PostgreSQL, synchronises all table schemas,
 * then disconnects cleanly.
 *
 * Usage:
 *   npx ts-node src/database/runner.ts
 *
 * Required environment variables (or uses local-dev defaults):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */
import 'dotenv/config';

import { pool, disconnect } from './client.js';
import { syncDatabase } from './sync-table.js';
import { allSchemas } from '../schemas/index.js';

async function main(): Promise<void> {
  console.log();
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       🗄️  Database Migration Runner              ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log();

  try {
    // Verify connectivity
    const result = await pool.query('SELECT current_database() AS db');
    console.log(`[MIGRATE] Connected to database: "${result.rows[0].db}"`);
    console.log();

    // Sync all schemas
    await syncDatabase(pool, allSchemas);

    console.log();
    console.log('[MIGRATE] 🎉 All migrations applied successfully!');
  } catch (error) {
    console.error('[MIGRATE] ❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnect();
    console.log('[MIGRATE] Connection closed.');
  }
}

main();
