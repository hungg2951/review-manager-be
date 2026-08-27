import { TableSchema } from './types.js';

/**
 * Type-safe helper to define a table schema.
 * Returns the schema object as-is — its purpose is to provide
 * autocompletion and type checking at the call site.
 */
export function defineTable(schema: TableSchema): TableSchema {
  return schema;
}
