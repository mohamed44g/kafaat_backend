import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

try {
  process.loadEnvFile('.env');
} catch {}

const require = createRequire(import.meta.url);
interface QueryResult<T> {
  rows: T[];
}
interface Pool {
  query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
  end(): Promise<void>;
}
const { Pool: PgPool } = require('pg') as {
  Pool: new (options: object) => Pool;
};

const migrations = [
  '001_initial_schema',
  '002_subscription_plans',
  '003_kuwaiti_monthly_plans',
  '004_bank_transfer_settings',
  '005_zoom_live_sessions',
  '006_jitsi_live_sessions',
];
const pool = new PgPool({ connectionString: process.env.DATABASE_URL });
const migrationPath = (name: string, down = false) =>
  resolve(
    process.cwd(),
    `src/database/migrations/${name}${down ? '.down' : ''}.sql`,
  );

async function appliedNames(): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY applied_at, name',
  );
  return new Set(result.rows.map((row) => row.name));
}

async function applyMigration(name: string): Promise<void> {
  await pool.query('BEGIN');
  try {
    await pool.query(await readFile(migrationPath(name), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
      name,
    ]);
    await pool.query('COMMIT');
    console.log(`${name}: applied`);
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = await appliedNames();

  if (process.argv.includes('--status')) {
    for (const name of migrations)
      console.log(`${name}: ${applied.has(name) ? 'applied' : 'pending'}`);
    return;
  }

  if (process.argv.includes('--revert')) {
    const name = [...migrations].reverse().find((item) => applied.has(item));
    if (!name) {
      console.log('No migration to revert');
      return;
    }
    await pool.query('BEGIN');
    try {
      await pool.query(await readFile(migrationPath(name, true), 'utf8'));
      await pool.query('DELETE FROM schema_migrations WHERE name = $1', [name]);
      await pool.query('COMMIT');
      console.log(`${name}: reverted`);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    return;
  }

  for (const name of migrations) {
    if (!applied.has(name)) await applyMigration(name);
    else console.log(`${name}: already applied`);
  }
}

try {
  await run();
} finally {
  await pool.end();
}
