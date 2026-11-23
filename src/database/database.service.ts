import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
type QueryResult<T> = { rows: T[]; rowCount: number | null };
interface Queryable {
  query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
}
interface PoolClient extends Queryable {
  release(): void;
}
interface Pool extends Queryable {
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}
const { Pool: PgPool } = require('pg') as {
  Pool: new (options: object) => Pool;
};

export type DatabaseExecutor = Queryable;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new PgPool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  query<T>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, values);
  }

  async oneOrNull<T>(sql: string, values: unknown[] = []): Promise<T | null> {
    return (await this.query<T>(sql, values)).rows[0] ?? null;
  }

  async transaction<T>(
    work: (client: DatabaseExecutor) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  onModuleDestroy(): Promise<void> {
    return this.pool.end();
  }
}
