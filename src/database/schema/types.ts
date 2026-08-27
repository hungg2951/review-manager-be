// ─── Supported PostgreSQL column types ───────────────────────────────────────

export type ColumnType =
  'uuid' | 'varchar' | 'text' | 'boolean' | 'timestamp' | 'int';

// ─── Foreign key reference ───────────────────────────────────────────────────

export type ReferentialAction =
  'CASCADE' | 'RESTRICT' | 'SET NULL' | 'SET DEFAULT' | 'NO ACTION';

export interface ColumnReference {
  /** Referenced table name, e.g. 'shops' */
  table: string;
  /** Referenced column name, e.g. 'id' */
  column: string;
  /** ON DELETE behavior (defaults to NO ACTION if omitted) */
  onDelete?: ReferentialAction;
  /** ON UPDATE behavior (defaults to NO ACTION if omitted) */
  onUpdate?: ReferentialAction;
}

// ─── Column definition ──────────────────────────────────────────────────────

export interface ColumnDefinition {
  /** PostgreSQL data type */
  type: ColumnType;
  /** Mark as PRIMARY KEY */
  primary?: boolean;
  /** Mark as NOT NULL */
  required?: boolean;
  /**
   * Explicitly mark as nullable (allows NULL). Optional — a column that is
   * simply not `required` is already nullable by default. Use this when you
   * want the intent to be explicit in the schema, e.g. author_email: { type: 'varchar', nullable: true }
   */
  nullable?: boolean;
  /** Mark as UNIQUE */
  unique?: boolean;
  /** DEFAULT value (string is inserted as-is for expressions like now()) */
  default?: string | number | boolean;
  /** FOREIGN KEY reference to another table's column */
  references?: ColumnReference;
}

// ─── Index definition ────────────────────────────────────────────────────────

export interface IndexDefinition {
  /** Name of the index (auto-generated if omitted) */
  name?: string;
  /** Column(s) to index */
  columns: string[];
  /** Create a UNIQUE index */
  unique?: boolean;
}

// ─── Table schema ────────────────────────────────────────────────────────────

export interface TableSchema {
  /** Table name */
  name: string;
  /** Column definitions keyed by column name */
  columns: Record<string, ColumnDefinition>;
  /** Optional index definitions */
  indexes?: IndexDefinition[];
}
