/** Redis 限流与防重放（Nonce/幂等键） */
import { getRedis } from './redis.js';

/** 固定窗口计数限流：返回 true=放行 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = getRedis();
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n <= limit;
}

/** Nonce 一次性检查（默认 5 分钟窗口）：true=首次出现 */
export async function checkNonce(scope: string, nonce: string, ttlSec = 300): Promise<boolean> {
  const ok = await getRedis().set(`nonce:${scope}:${nonce}`, '1', 'EX', ttlSec, 'NX');
  return ok === 'OK';
}

/** 幂等响应缓存：首次返回 null 并占位；重复返回缓存内容 */
export async function idempotentGet(key: string): Promise<string | null> {
  return getRedis().get(`idem:${key}`);
}

export async function idempotentSet(key: string, value: string, ttlSec = 600): Promise<void> {
  await getRedis().set(`idem:${key}`, value, 'EX', ttlSec);
}

/** 登录失败计数（撞库/暴力破解防御） */
export async function loginFailCount(id: string): Promise<number> {
  const redis = getRedis();
  const k = `loginfail:${id}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, 900);
  return n;
}

export async function loginFailReset(id: string): Promise<void> {
  await getRedis().del(`loginfail:${id}`);
}
