import { syncTable, syncDatabase } from './sync-table';
import type { TableSchema } from './schema/types';

// ─── Mock pg.Pool ────────────────────────────────────────────────────────────

function createMockPool(opts: {
  tableExists?: boolean;
  existingColumns?: string[];
}) {
  const queries: string[] = [];

  const mockPool = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      queries.push(sql);

      // information_schema.tables check
      if (sql.includes('information_schema.tables')) {
        return { rows: [{ exists: opts.tableExists ?? false }] };
      }

      // information_schema.columns check
      if (sql.includes('information_schema.columns')) {
        const cols = (opts.existingColumns ?? []).map((c) => ({
          column_name: c,
        }));
        return { rows: cols };
      }

      return { rows: [] };
    }),

    /** Expose captured queries for assertions */
    _queries: queries,
  };

  return mockPool as any;
}

// ─── Test fixtures ───────────────────────────────────────────────────────────

const testSchema: TableSchema = {
  name: 'campaigns',
  columns: {
    id: { type: 'uuid', primary: true },
    name: { type: 'varchar', required: true },
    status: { type: 'varchar', default: 'draft' },
    created_at: { type: 'timestamp', default: 'now()' },
  },
  indexes: [{ columns: ['status'] }],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('syncTable', () => {
  it('should CREATE TABLE when it does not exist', async () => {
    const pool = createMockPool({ tableExists: false });

    await syncTable(pool, testSchema);

    const createCall = pool._queries.find((q: string) =>
      q.includes('CREATE TABLE'),
    );
    expect(createCall).toBeDefined();
    expect(createCall).toContain('"campaigns"');
    expect(createCall).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(createCall).toContain('"name" VARCHAR(255) NOT NULL');
    expect(createCall).toContain("DEFAULT 'draft'");
    expect(createCall).toContain('DEFAULT now()');
  });

  it('should ADD COLUMN when table exists but columns are missing', async () => {
    const pool = createMockPool({
      tableExists: true,
      existingColumns: ['id', 'name'], // missing: status, created_at
    });

    await syncTable(pool, testSchema);

    const alterCalls = pool._queries.filter((q: string) =>
      q.includes('ALTER TABLE'),
    );
    expect(alterCalls).toHaveLength(2); // status + created_at

    expect(alterCalls[0]).toContain('"status"');
    expect(alterCalls[1]).toContain('"created_at"');
  });

  it('should SKIP columns that already exist', async () => {
    const pool = createMockPool({
      tableExists: true,
      existingColumns: ['id', 'name', 'status', 'created_at'],
    });

    await syncTable(pool, testSchema);

    const alterCalls = pool._queries.filter((q: string) =>
      q.includes('ALTER TABLE'),
    );
    expect(alterCalls).toHaveLength(0);
  });

  it('should CREATE INDEX', async () => {
    const pool = createMockPool({ tableExists: false });

    await syncTable(pool, testSchema);

    const indexCall = pool._queries.find((q: string) =>
      q.includes('CREATE') && q.includes('INDEX'),
    );
    expect(indexCall).toBeDefined();
    expect(indexCall).toContain('"idx_campaigns_status"');
    expect(indexCall).toContain('"status"');
  });
});

describe('syncDatabase', () => {
  it('should ensure pgcrypto extension and sync all schemas', async () => {
    const pool = createMockPool({ tableExists: false });

    await syncDatabase(pool, [testSchema]);

    // pgcrypto extension should be first query
    expect(pool._queries[0]).toContain('CREATE EXTENSION');
    expect(pool._queries[0]).toContain('pgcrypto');

    // Table should be created
    const createCall = pool._queries.find((q: string) =>
      q.includes('CREATE TABLE'),
    );
    expect(createCall).toBeDefined();
  });
});
