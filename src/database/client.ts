import pg from 'pg';
import { pool } from './postgres.client';

export { pool };

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function disconnect(): Promise<void> {
  await pool.end();
}
