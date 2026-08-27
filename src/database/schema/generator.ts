import type { ColumnDefinition, ColumnType, TableSchema } from './types.js';

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Map our abstract types to PostgreSQL data types */
const PG_TYPE_MAP: Record<ColumnType, string> = {
  uuid: 'UUID',
  varchar: 'VARCHAR(255)',
  text: 'TEXT',
  boolean: 'BOOLEAN',
  timestamp: 'TIMESTAMPTZ',
  int: 'INTEGER',
};

/**
 * Known SQL expressions that should NOT be quoted.
 * Everything else is treated as a literal and wrapped in single quotes.
 */
const SQL_EXPRESSION_PATTERNS = [
  /^now\(\)$/i,
  /^current_timestamp$/i,
  /^gen_random_uuid\(\)$/i,
  /^true$/i,
  /^false$/i,
  /^null$/i,
];

function isSqlExpression(value: string): boolean {
  return SQL_EXPRESSION_PATTERNS.some((pattern) => pattern.test(value));
}

function formatDefault(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  // String values
  if (isSqlExpression(value)) return value;
  return `'${value.replace(/'/g, "''")}'`; // escape single quotes
}

/** Build inline `REFERENCES "table"("column") ON DELETE ... ON UPDATE ...` clause */
function buildReferencesSQL(definition: ColumnDefinition): string | null {
  if (!definition.references) return null;

  const { table, column, onDelete, onUpdate } = definition.references;
  const parts = [`REFERENCES "${table}"("${column}")`];

  if (onDelete) parts.push(`ON DELETE ${onDelete}`);
  if (onUpdate) parts.push(`ON UPDATE ${onUpdate}`);

  return parts.join(' ');
}

// ─── Column SQL builder ─────────────────────────────────────────────────────

function buildColumnSQL(
  columnName: string,
  definition: ColumnDefinition,
): string {
  const parts: string[] = [];

  // 1. Column name (quoted to handle reserved words)
  parts.push(`"${columnName}"`);

  // 2. Data type
  parts.push(PG_TYPE_MAP[definition.type]);

  // 3. Constraints & defaults

  if (definition.primary) {
    parts.push('PRIMARY KEY');
  }

  // NOT NULL is added when the column is required AND not explicitly
  // marked nullable. `nullable: true` always wins, so it can override
  // `required: true` if both are set (nullable takes precedence).
  if (
    definition.required &&
    !definition.primary &&
    definition.nullable !== true
  ) {
    parts.push('NOT NULL');
  }

  if (definition.unique && !definition.primary) {
    parts.push('UNIQUE');
  }

  // Default value — auto-add gen_random_uuid() for UUID primary keys
  if (definition.default !== undefined) {
    parts.push(`DEFAULT ${formatDefault(definition.default)}`);
  } else if (definition.type === 'uuid' && definition.primary) {
    parts.push('DEFAULT gen_random_uuid()');
  }

  // 4. Foreign key reference (inline column-level FK)
  const referencesSQL = buildReferencesSQL(definition);
  if (referencesSQL) {
    parts.push(referencesSQL);
  }

  return parts.join(' ');
}

// ─── CREATE TABLE ────────────────────────────────────────────────────────────

/**
 * Generate a `CREATE TABLE` SQL statement from a `TableSchema`.
 *
 * @param schema  - The table definition
 * @param options - `ifNotExists`: wraps statement with `IF NOT EXISTS` (default `false`)
 * @returns A valid PostgreSQL `CREATE TABLE` string
 */
export function generateCreateTableSQL(
  schema: TableSchema,
  options: { ifNotExists?: boolean } = {},
): string {
  const { ifNotExists = false } = options;

  const columnLines = Object.entries(schema.columns).map(
    ([name, def]) => `  ${buildColumnSQL(name, def)}`,
  );

  const existsClause = ifNotExists ? ' IF NOT EXISTS' : '';

  const lines = [
    `CREATE TABLE${existsClause} "${schema.name}" (`,
    columnLines.join(',\n'),
    ');',
  ];

  return lines.join('\n');
}

// ─── ALTER TABLE (add missing columns) ───────────────────────────────────────

/**
 * Generate `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements
 * for every column in the schema. Useful for forward-migration scripts.
 *
 * Note: Postgres allows inline REFERENCES on ADD COLUMN for single-column
 * foreign keys, so this works the same way as in CREATE TABLE.
 */
export function generateAlterTableSQL(schema: TableSchema): string {
  const statements = Object.entries(schema.columns).map(([name, def]) => {
    const colSQL = buildColumnSQL(name, def);
    return `ALTER TABLE "${schema.name}" ADD COLUMN IF NOT EXISTS ${colSQL};`;
  });

  return statements.join('\n');
}

// ─── CREATE INDEX ────────────────────────────────────────────────────────────

/**
 * Generate `CREATE INDEX` statements for any indexes defined on the schema.
 */
export function generateIndexSQL(schema: TableSchema): string {
  if (!schema.indexes?.length) return '';

  return schema.indexes
    .map((idx) => {
      const indexName =
        idx.name ?? `idx_${schema.name}_${idx.columns.join('_')}`;
      const uniqueClause = idx.unique ? 'UNIQUE ' : '';
      const columnList = idx.columns.map((c) => `"${c}"`).join(', ');

      return `CREATE ${uniqueClause}INDEX IF NOT EXISTS "${indexName}" ON "${schema.name}" (${columnList});`;
    })
    .join('\n');
}

// ─── Full migration helper ──────────────────────────────────────────────────

/**
 * Generate a complete migration script:
 *   1. CREATE TABLE IF NOT EXISTS
 *   2. ALTER TABLE ADD COLUMN IF NOT EXISTS (idempotent column additions)
 *   3. CREATE INDEX IF NOT EXISTS
 */
export function generateMigrationSQL(schema: TableSchema): string {
  const parts = [
    generateCreateTableSQL(schema, { ifNotExists: true }),
    '',
    generateAlterTableSQL(schema),
  ];

  const indexSQL = generateIndexSQL(schema);
  if (indexSQL) {
    parts.push('', indexSQL);
  }

  return parts.join('\n');
}
