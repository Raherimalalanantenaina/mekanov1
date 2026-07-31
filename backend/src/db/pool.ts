import { Pool } from 'pg';
import { config } from '../config';

// Les bases hébergées (Neon, Render, Supabase…) exigent SSL,
// contrairement au Postgres local en Docker.
const isLocal =
  config.databaseUrl.includes('localhost') ||
  config.databaseUrl.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}
