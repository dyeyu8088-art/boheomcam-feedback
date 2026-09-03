/** 规则/场次配置装载（DB 为准，60s 缓存；发布新版本 60s 内生效） */
import { query } from '@yanbian/server-core';
import { YANBIAN_DRAFT_RULE, type MahjongRuleConfig } from '@yanbian/game-common/mahjong';
import { HONGSHI_DRAFT_RULE, type HongshiRuleConfig } from '@yanbian/game-common/hongshi';
import { FRUIT_GOLD_V2 as FRUIT_GOLD_V1, type SlotPaytableConfig } from '@yanbian/game-common/slot';
import type { StageConf } from './room.js';

const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 60000;

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function loadRule<T>(gameId: string, fallback: T): Promise<T> {
  return cached(`rule:${gameId}`, async () => {
    const r = await query(
      `SELECT config FROM game_configs WHERE game_id=$1 AND config_key='rule' AND status='active' ORDER BY id DESC LIMIT 1`,
      [gameId],
    );
    return (r.rows[0]?.config as T) ?? fallback;
  });
}

export const loadMahjongRule = (): Promise<MahjongRuleConfig> => loadRule('mahjong_yanbian', YANBIAN_DRAFT_RULE);
export const loadHongshiRule = (): Promise<HongshiRuleConfig> => loadRule('hongshi', HONGSHI_DRAFT_RULE);

export async function loadStages(gameId: string): Promise<StageConf[]> {
  return cached(`stages:${gameId}`, async () => {
    const r = await query(
      `SELECT config FROM game_configs WHERE game_id=$1 AND config_key='stages' AND status='active' ORDER BY id DESC LIMIT 1`,
      [gameId],
    );
    return ((r.rows[0]?.config as { stages?: StageConf[] } | undefined)?.stages ?? []) as StageConf[];
  });
}

export async function loadPaytable(): Promise<SlotPaytableConfig> {
  return cached('paytable:slot_fruit', async () => {
    const r = await query(
      `SELECT config FROM slot_paytables WHERE game_id='slot_fruit' AND status='active' ORDER BY id DESC LIMIT 1`,
    );
    return (r.rows[0]?.config as SlotPaytableConfig) ?? FRUIT_GOLD_V1;
  });
}

export async function gameOnline(gameId: string): Promise<boolean> {
  return cached(`gstatus:${gameId}`, async () => {
    const r = await query(`SELECT status FROM games WHERE game_id=$1`, [gameId]);
    return r.rows[0]?.status === 'online';
  });
}
