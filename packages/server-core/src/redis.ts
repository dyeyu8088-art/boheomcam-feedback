import { Redis } from 'ioredis';
import { loadEnv } from './env.js';

let client: Redis | null = null;
let sub: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(loadEnv().redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
    client.on('error', (e) => console.error('[redis error]', e.message));
  }
  return client;
}

/** 订阅专用连接（ioredis 订阅态连接不能复用于普通命令） */
export function getRedisSub(): Redis {
  if (!sub) {
    sub = new Redis(loadEnv().redisUrl, { maxRetriesPerRequest: 3 });
    sub.on('error', (e) => console.error('[redis sub error]', e.message));
  }
  return sub;
}

export async function closeRedis(): Promise<void> {
  await client?.quit();
  await sub?.quit();
  client = null;
  sub = null;
}
