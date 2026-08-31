/** MessageBus 抽象（Redis Pub/Sub 实现；接口可平移 NATS） */
import { getRedis, getRedisSub } from './redis.js';

export type BusHandler = (payload: Record<string, unknown>) => void;

const handlers = new Map<string, Set<BusHandler>>();
let subscribed = false;

function ensureSubscriber(): void {
  if (subscribed) return;
  subscribed = true;
  const sub = getRedisSub();
  sub.on('pmessage', (_pattern, channel, message) => {
    const set = handlers.get(channel);
    if (!set || set.size === 0) return;
    try {
      const payload = JSON.parse(message) as Record<string, unknown>;
      for (const h of set) h(payload);
    } catch {
      /* 非法消息忽略 */
    }
  });
  void sub.psubscribe('bus.*');
}

export async function busPublish(channel: string, payload: Record<string, unknown>): Promise<void> {
  await getRedis().publish(channel, JSON.stringify(payload));
}

export function busSubscribe(channel: string, handler: BusHandler): () => void {
  ensureSubscriber();
  let set = handlers.get(channel);
  if (!set) {
    set = new Set();
    handlers.set(channel, set);
  }
  set.add(handler);
  return () => set!.delete(handler);
}
