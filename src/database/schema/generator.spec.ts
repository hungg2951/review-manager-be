import { defineTable } from './define-table';
import {
  generateCreateTableSQL,
  generateAlterTableSQL,
  generateIndexSQL,
  generateMigrationSQL,
} from './generator';
import type { TableSchema } from './types';

describe('Schema-to-SQL Generator', () => {
  // ─── Fixtures ────────────────────────────────────────────────────────────

  const campaignsSchema: TableSchema = defineTable({
    name: 'campaigns',
    columns: {
      id: { type: 'uuid', primary: true },
      name: { type: 'varchar', required: true },
      status: { type: 'varchar', default: 'draft' },
      created_at: { type: 'timestamp', default: 'now()' },
    },
  });

  const usersSchema: TableSchema = defineTable({
    name: 'users',
    columns: {
      id: { type: 'uuid', primary: true, default: 'gen_random_uuid()' },
      email: { type: 'varchar', required: true, unique: true },
      bio: { type: 'text' },
      is_admin: { type: 'boolean', default: false },
      age: { type: 'int' },
      created_at: { type: 'timestamp', default: 'now()' },
    },
    indexes: [
      { columns: ['email'], unique: true },
      { columns: ['is_admin', 'age'], name: 'idx_users_admin_age' },
    ],
  });

  // ─── generateCreateTableSQL ──────────────────────────────────────────────

  describe('generateCreateTableSQL', () => {
    it('should generate a valid CREATE TABLE statement', () => {
      const sql = generateCreateTableSQL(campaignsSchema);

      expect(sql).toContain('CREATE TABLE "campaigns"');
      expect(sql).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
      expect(sql).toContain('"name" VARCHAR(255) NOT NULL');
      expect(sql).toContain("\"status\" VARCHAR(255) DEFAULT 'draft'");
      expect(sql).toContain('"created_at" TIMESTAMPTZ DEFAULT now()');
      expect(sql).toMatch(/\);$/);
    });

    it('should support IF NOT EXISTS', () => {
      const sql = generateCreateTableSQL(campaignsSchema, {
        ifNotExists: true,
      });

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "campaigns"');
    });

    it('should auto-add gen_random_uuid() for uuid primary keys without explicit default', () => {
      const sql = generateCreateTableSQL(campaignsSchema);
      expect(sql).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    });

    it('should use explicit default for uuid primary keys when provided', () => {
      const sql = generateCreateTableSQL(usersSchema);
      expect(sql).toContain(
        '"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      );
    });

    it('should handle boolean defaults', () => {
      const sql = generateCreateTableSQL(usersSchema);
      expect(sql).toContain('"is_admin" BOOLEAN DEFAULT FALSE');
    });

    it('should not add NOT NULL or UNIQUE to primary key columns', () => {
      const schema = defineTable({
        name: 'test',
        columns: {
          id: { type: 'uuid', primary: true, required: true, unique: true },
        },
      });
      const sql = generateCreateTableSQL(schema);

      // PRIMARY KEY already implies NOT NULL + UNIQUE
      expect(sql).not.toMatch(/NOT NULL/);
      expect(sql).not.toMatch(/UNIQUE/);
    });

    it('should quote string defaults and escape single quotes', () => {
      const schema = defineTable({
        name: 'test',
        columns: {
          note: { type: 'text', default: "it's a test" },
        },
      });
      const sql = generateCreateTableSQL(schema);
      expect(sql).toContain("DEFAULT 'it''s a test'");
    });

    it('should handle numeric defaults', () => {
      const schema = defineTable({
        name: 'test',
        columns: {
          count: { type: 'int', default: 42 },
        },
      });
      const sql = generateCreateTableSQL(schema);
      expect(sql).toContain('DEFAULT 42');
    });
  });

  // ─── generateAlterTableSQL ───────────────────────────────────────────────

  describe('generateAlterTableSQL', () => {
    it('should generate ALTER TABLE ADD COLUMN IF NOT EXISTS for each column', () => {
      const sql = generateAlterTableSQL(campaignsSchema);

      expect(sql).toContain(
        'ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "id" UUID PRIMARY KEY DEFAULT gen_random_uuid();',
      );
      expect(sql).toContain(
        'ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;',
      );
      expect(sql).toContain(
        'ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now();',
      );
    });
  });

  // ─── generateIndexSQL ────────────────────────────────────────────────────

  describe('generateIndexSQL', () => {
    it('should return empty string when no indexes are defined', () => {
      expect(generateIndexSQL(campaignsSchema)).toBe('');
    });

    it('should generate CREATE INDEX statements', () => {
      const sql = generateIndexSQL(usersSchema);

      expect(sql).toContain(
        'CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");',
      );
      expect(sql).toContain(
        'CREATE INDEX IF NOT EXISTS "idx_users_admin_age" ON "users" ("is_admin", "age");',
      );
    });

    it('should auto-generate index names when not provided', () => {
      const sql = generateIndexSQL(usersSchema);
      expect(sql).toContain('idx_users_email');
    });
  });

  // ─── generateMigrationSQL ───────────────────────────────────────────────

  describe('generateMigrationSQL', () => {
    it('should combine CREATE TABLE, ALTER TABLE, and indexes', () => {
      const sql = generateMigrationSQL(usersSchema);

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
      expect(sql).toContain('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS');
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
    });
  });
});
