import type { ColumnType } from '../schema/types.js';

/**
 * Maps abstract column types to PostgreSQL data type strings.
 * Centralised here so both SQL generation and introspection logic
 * reference the same mapping.
 */
export const PG_TYPE_MAP: Record<ColumnType, string> = {
  uuid: 'UUID',
  varchar: 'VARCHAR(255)',
  text: 'TEXT',
  boolean: 'BOOLEAN',
  timestamp: 'TIMESTAMPTZ',
  int: 'INTEGER',
};

/**
 * Known SQL expressions that should NOT be quoted when used as defaults.
 */
const SQL_EXPRESSION_PATTERNS = [
  /^now\(\)$/i,
  /^current_timestamp$/i,
  /^gen_random_uuid\(\)$/i,
  /^true$/i,
  /^false$/i,
  /^null$/i,
];

export function isSqlExpression(value: string): boolean {
  return SQL_EXPRESSION_PATTERNS.some((p) => p.test(value));
}

/**
 * Format a default value for use in a SQL DEFAULT clause.
 * - Numbers → raw
 * - Booleans → TRUE / FALSE
 * - SQL expressions (now(), gen_random_uuid(), …) → raw
 * - Everything else → single-quoted string with escaping
 */
export function formatDefault(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (isSqlExpression(value)) return value;
  return `'${value.replace(/'/g, "''")}'`;
}
