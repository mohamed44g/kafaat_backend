import { createRequire } from 'node:module';

try {
  process.loadEnvFile('.env');
} catch {}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const target = new URL(connectionString);
const databaseName = target.pathname.slice(1);
if (!/^[a-z][a-z0-9_]{0,62}$/i.test(databaseName)) {
  throw new Error('DATABASE_URL contains an invalid database name');
}
target.pathname = '/postgres';
const require = createRequire(import.meta.url);
const { Client } = require('pg') as {
  Client: new (options: object) => {
    connect(): Promise<void>;
    query(
      sql: string,
      values?: unknown[],
    ): Promise<{ rowCount: number | null }>;
    end(): Promise<void>;
  };
};
const client = new Client({ connectionString: target.toString() });
try {
  await client.connect();
  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  );
  if (!existing.rowCount)
    await client.query(`CREATE DATABASE "${databaseName}"`);
  console.log(`Database ${databaseName} is ready`);
} finally {
  await client.end();
}
