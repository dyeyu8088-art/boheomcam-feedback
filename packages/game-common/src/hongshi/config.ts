/**
 * 红十规则配置 Schema —— 对应《红十规则确认表》。
 * 默认值为 `hongshi_2026_01.draft` 开发联调临时值（逐项待当地确认）。
 */
import { makeCard, SUIT_DIAMOND, SUIT_HEART, type Card } from './cards.js';

export type HsComboType = 'single' | 'pair' | 'triple' | 'straight' | 'pairStraight' | 'bomb';

export interface HongshiRuleConfig {
  ruleVersion: string;
  playerCounts: number[];
  deckCount: number;
  /** 身份牌（“红十”） */
  identityCards: Card[];
  identityReveal: 'open' | 'hidden';
  /** 一人持全部红十 → 独打 */
  soloWhenAll: boolean;
  /** 点数由小到大的牌力序（rank 1..13） */
  rankOrder: number[];
  combos: {
    allowed: HsComboType[];
    straightMinLen: number;
    pairStraightMinPairs: number;
    straightWith2: boolean;
    bombBeatsAny: boolean;
  };
  mustBeat: boolean;
  timing: { turnSeconds: number };
  score: {
    /** 名次分（按人数索引，如 4 人 [2,1,-1,-2]） */
    rankPoints: number[];
    doubleWinMultiplier: number;
    soloWinMultiplier: number;
    maxMultiplier: number;
  };
  match: { roundOptions: number[] };
}

export const HONGSHI_DRAFT_RULE: HongshiRuleConfig = {
  ruleVersion: 'hongshi_2026_01.draft',
  playerCounts: [4],
  deckCount: 1,
  identityCards: [makeCard(SUIT_HEART, 10), makeCard(SUIT_DIAMOND, 10)],
  identityReveal: 'hidden',
  soloWhenAll: true,
  // 3 最小 … 2 最大
  rankOrder: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2],
  combos: {
    allowed: ['single', 'pair', 'triple', 'straight', 'pairStraight', 'bomb'],
    straightMinLen: 5,
    pairStraightMinPairs: 3,
    straightWith2: false,
    bombBeatsAny: true,
  },
  mustBeat: false,
  timing: { turnSeconds: 15 },
  score: {
    rankPoints: [2, 1, -1, -2],
    doubleWinMultiplier: 2,
    soloWinMultiplier: 3,
    maxMultiplier: 8,
  },
  match: { roundOptions: [4, 8, 16] },
};

export function validateHongshiRule(cfg: HongshiRuleConfig): string[] {
  const errors: string[] = [];
  for (const pc of cfg.playerCounts) {
    if ((52 * cfg.deckCount) % pc !== 0) errors.push(`${pc} 人无法均分 ${52 * cfg.deckCount} 张牌`);
  }
  if (cfg.rankOrder.length !== 13 || new Set(cfg.rankOrder).size !== 13) errors.push('rankOrder 必须包含 1..13 各一次');
  if (cfg.identityCards.length === 0) errors.push('identityCards 不能为空');
  if (cfg.score.rankPoints.reduce((a, b) => a + b, 0) !== 0) errors.push('rankPoints 之和必须为 0（零和）');
  return errors;
}
