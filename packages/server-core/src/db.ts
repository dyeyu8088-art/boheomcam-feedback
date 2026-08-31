/** PostgreSQL 连接池与事务助手（全部参数化查询，杜绝拼接 SQL） */
import pg from 'pg';
import { loadEnv } from './env.js';

// BIGINT → number（本项目金额/ID 均在安全整数范围内；ID 生成器已控制在 2^53 内）
pg.types.setTypeParser(20, (v: string) => Number(v));

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const env = loadEnv();
    pool = new pg.Pool({ connectionString: env.databaseUrl, max: 20, idleTimeoutMillis: 30000 });
    pool.on('error', (err) => {
      // 连接池后台错误不应击穿进程
      console.error('[pg pool error]', err.message);
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/** 事务：回调抛错自动回滚 */
export async function withTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* 连接已坏，release 处理 */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
