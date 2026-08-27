/**
 * Example usage of the schema-to-SQL generator.
 *
 * Run:  npx ts-node src/database/schema/example.ts
 */

import { defineTable } from './define-table.js';
import {
  generateCreateTableSQL,
  generateAlterTableSQL,
  generateIndexSQL,
  generateMigrationSQL,
} from './generator.js';

// ─── 1. Define table schema ─────────────────────────────────────────────────

const campaignsTable = defineTable({
  name: 'campaigns',
  columns: {
    id: { type: 'uuid', primary: true },
    name: { type: 'varchar', required: true },
    description: { type: 'text' },
    status: { type: 'varchar', default: 'draft' },
    is_active: { type: 'boolean', default: true },
    budget: { type: 'int' },
    created_at: { type: 'timestamp', default: 'now()' },
    updated_at: { type: 'timestamp', default: 'now()' },
  },
  indexes: [
    { columns: ['status'] },
    { columns: ['name'], unique: true },
    { columns: ['status', 'is_active'], name: 'idx_campaigns_active_status' },
  ],
});

// ─── 2. Generate CREATE TABLE ────────────────────────────────────────────────

console.log('=== CREATE TABLE ===\n');
console.log(generateCreateTableSQL(campaignsTable));

// ─── 3. Generate CREATE TABLE IF NOT EXISTS ──────────────────────────────────

console.log('\n=== CREATE TABLE IF NOT EXISTS ===\n');
console.log(generateCreateTableSQL(campaignsTable, { ifNotExists: true }));

// ─── 4. Generate ALTER TABLE (add columns idempotently) ──────────────────────

console.log('\n=== ALTER TABLE ===\n');
console.log(generateAlterTableSQL(campaignsTable));

// ─── 5. Generate indexes ────────────────────────────────────────────────────

console.log('\n=== INDEXES ===\n');
console.log(generateIndexSQL(campaignsTable));

// ─── 6. Full migration script ───────────────────────────────────────────────

console.log('\n=== FULL MIGRATION ===\n');
console.log(generateMigrationSQL(campaignsTable));
