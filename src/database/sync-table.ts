import pg from 'pg';
import type { ColumnDefinition, TableSchema } from './schema/types.js';
import { PG_TYPE_MAP, formatDefault } from './utils/map-type.js';

// ─── Logging helpers ─────────────────────────────────────────────────────────

const PREFIX = '[MIGRATE]';

function log(message: string): void {
  console.log(`${PREFIX} ${message}`);
}

function logSuccess(message: string): void {
  console.log(`${PREFIX} ✅ ${message}`);
}

function logSkip(message: string): void {
  console.log(`${PREFIX} ⏭️  ${message}`);
}

// ─── Column SQL builder ─────────────────────────────────────────────────────

function buildColumnSQL(
  columnName: string,
  def: ColumnDefinition,
): string {
  const parts: string[] = [`"${columnName}"`, PG_TYPE_MAP[def.type]];

  if (def.primary) parts.push('PRIMARY KEY');
  if (def.required && !def.primary) parts.push('NOT NULL');
  if (def.unique && !def.primary) parts.push('UNIQUE');

  if (def.default !== undefined) {
    parts.push(`DEFAULT ${formatDefault(def.default)}`);
  } else if (def.type === 'uuid' && def.primary) {
    parts.push('DEFAULT gen_random_uuid()');
  }

  return parts.join(' ');
}

// ─── Table existence check ───────────────────────────────────────────────────

async function tableExists(
  client: pg.Pool,
  tableName: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS "exists"`,
    [tableName],
  );
  return result.rows[0]?.exists === true;
}

// ─── Existing columns check ─────────────────────────────────────────────────

async function getExistingColumns(
  client: pg.Pool,
  tableName: string,
): Promise<Set<string>> {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return new Set(result.rows.map((r) => r.column_name as string));
}

// ─── CREATE TABLE ────────────────────────────────────────────────────────────

async function createTable(
  client: pg.Pool,
  schema: TableSchema,
): Promise<void> {
  const columnLines = Object.entries(schema.columns).map(
    ([name, def]) => `  ${buildColumnSQL(name, def)}`,
  );

  const sql = [
    `CREATE TABLE IF NOT EXISTS "${schema.name}" (`,
    columnLines.join(',\n'),
    ');',
  ].join('\n');

  await client.query(sql);
  logSuccess(`Created table "${schema.name}"`);
}

// ─── ADD MISSING COLUMNS ────────────────────────────────────────────────────

async function addMissingColumns(
  client: pg.Pool,
  schema: TableSchema,
  existingCols: Set<string>,
): Promise<void> {
  for (const [colName, colDef] of Object.entries(schema.columns)) {
    if (existingCols.has(colName)) {
      logSkip(`Column "${schema.name}"."${colName}" already exists`);
      continue;
    }

    const colSQL = buildColumnSQL(colName, colDef);
    const sql = `ALTER TABLE "${schema.name}" ADD COLUMN ${colSQL};`;

    await client.query(sql);
    logSuccess(`Added column "${schema.name}"."${colName}"`);
  }
}

// ─── SYNC INDEXES ────────────────────────────────────────────────────────────

async function syncIndexes(
  client: pg.Pool,
  schema: TableSchema,
): Promise<void> {
  if (!schema.indexes?.length) return;

  for (const idx of schema.indexes) {
    const indexName =
      idx.name ?? `idx_${schema.name}_${idx.columns.join('_')}`;
    const uniqueClause = idx.unique ? 'UNIQUE ' : '';
    const columnList = idx.columns.map((c) => `"${c}"`).join(', ');

    const sql = `CREATE ${uniqueClause}INDEX IF NOT EXISTS "${indexName}" ON "${schema.name}" (${columnList});`;

    await client.query(sql);
    logSuccess(`Ensured index "${indexName}" on "${schema.name}"`);
  }
}

// ─── PUBLIC: syncTable ──────────────────────────────────────────────────────

/**
 * Synchronise a single table definition against the database.
 *
 * - If the table does **not** exist → `CREATE TABLE`
 * - If the table **does** exist → detect and `ADD COLUMN` for any missing columns
 * - Always ensures indexes exist
 *
 * Fully idempotent — safe to run repeatedly.
 */
export async function syncTable(
  client: pg.Pool,
  schema: TableSchema,
): Promise<void> {
  log(`Syncing table "${schema.name}"…`);

  const exists = await tableExists(client, schema.name);

  if (!exists) {
    await createTable(client, schema);
  } else {
    logSkip(`Table "${schema.name}" already exists — checking columns`);
    const existingCols = await getExistingColumns(client, schema.name);
    await addMissingColumns(client, schema, existingCols);
  }

  await syncIndexes(client, schema);
}

// ─── PUBLIC: syncDatabase ───────────────────────────────────────────────────

/**
 * Synchronise **all** table schemas against the database.
 * Tables are processed sequentially to keep log output readable.
 */
export async function syncDatabase(
  client: pg.Pool,
  schemas: TableSchema[],
): Promise<void> {
  log('─── Starting database sync ───────────────────────');

  // Ensure pgcrypto is available (needed for gen_random_uuid)
  await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  logSuccess('Extension "pgcrypto" ensured');

  for (const schema of schemas) {
    await syncTable(client, schema);
    console.log(); // blank line between tables
  }

  log('─── Database sync complete ───────────────────────');
}
