import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'mint_marketing',
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err);
});

export async function checkPostgresConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
    return true;
  } catch (error: any) {
    console.log(`❌ PostgreSQL connection failed: ${error.message || error}`);
    return false;
  }
}

export async function disconnectPostgres(): Promise<void> {
  await pool.end();
}