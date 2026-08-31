/** 红十牌型解析与比较（全部由配置驱动） */
import { rankOf, type Card } from './cards.js';
import type { HongshiRuleConfig, HsComboType } from './config.js';

export interface HsCombo {
  type: HsComboType;
  cards: Card[];
  /** 主键牌力（顺子取最高位牌力；炸弹另比张数） */
  power: number;
  length: number;
}

/** rank → 牌力（越大越强） */
export function powerOf(rank: number, cfg: HongshiRuleConfig): number {
  return cfg.rankOrder.indexOf(rank);
}

/** 解析一组选牌是否构成合法牌型；不合法返回 null */
export function parseCombo(cards: Card[], cfg: HongshiRuleConfig): HsCombo | null {
  if (cards.length === 0) return null;
  const ranks = cards.map(rankOf);
  const powers = ranks.map((r) => powerOf(r, cfg)).sort((a, b) => a - b);
  const uniq = new Map<number, number>();
  for (const p of powers) uniq.set(p, (uniq.get(p) ?? 0) + 1);
  const allowed = (t: HsComboType) => cfg.combos.allowed.includes(t);
  const n = cards.length;

  if (n === 1 && allowed('single')) return { type: 'single', cards, power: powers[0]!, length: 1 };
  if (uniq.size === 1) {
    const p = powers[0]!;
    if (n === 2 && allowed('pair')) return { type: 'pair', cards, power: p, length: 2 };
    if (n === 3 && allowed('triple')) return { type: 'triple', cards, power: p, length: 3 };
    if (n >= 4 && allowed('bomb')) return { type: 'bomb', cards, power: p, length: n };
  }
  // 顺子
  if (allowed('straight') && n >= cfg.combos.straightMinLen && uniq.size === n) {
    if (isConsecutive([...uniq.keys()].sort((a, b) => a - b)) && straight2Ok(ranks, cfg)) {
      return { type: 'straight', cards, power: powers[n - 1]!, length: n };
    }
  }
  // 连对
  if (allowed('pairStraight') && n >= cfg.combos.pairStraightMinPairs * 2 && n % 2 === 0) {
    const keys = [...uniq.keys()].sort((a, b) => a - b);
    if ([...uniq.values()].every((c) => c === 2) && isConsecutive(keys) && straight2Ok(ranks, cfg)) {
      return { type: 'pairStraight', cards, power: keys[keys.length - 1]!, length: n / 2 };
    }
  }
  return null;
}

function isConsecutive(sortedPowers: number[]): boolean {
  for (let i = 1; i < sortedPowers.length; i += 1) {
    if (sortedPowers[i]! !== sortedPowers[i - 1]! + 1) return false;
  }
  return true;
}

function straight2Ok(ranks: number[], cfg: HongshiRuleConfig): boolean {
  if (cfg.combos.straightWith2) return true;
  return !ranks.includes(2);
}

/** b 是否能压过 a */
export function beats(a: HsCombo, b: HsCombo, cfg: HongshiRuleConfig): boolean {
  if (b.type === 'bomb' && cfg.combos.bombBeatsAny) {
    if (a.type !== 'bomb') return true;
    if (b.length !== a.length) return b.length > a.length;
    return b.power > a.power;
  }
  if (a.type === 'bomb') return false;
  if (a.type !== b.type) return false;
  if (a.type === 'straight' || a.type === 'pairStraight') {
    if (a.length !== b.length) return false;
  }
  return b.power > a.power;
}

/** 提示：从手牌中找出能压过 target 的最小牌组（找不到返回 null） */
export function findHint(hand: Card[], target: HsCombo | null, cfg: HongshiRuleConfig): Card[] | null {
  const byPower = [...hand].sort((x, y) => powerOf(rankOf(x), cfg) - powerOf(rankOf(y), cfg));
  if (target === null) {
    return [byPower[0]!]; // 任意起手：出最小单张
  }
  const groups = new Map<number, Card[]>();
  for (const c of byPower) {
    const p = powerOf(rankOf(c), cfg);
    const g = groups.get(p) ?? [];
    g.push(c);
    groups.set(p, g);
  }
  const sortedPowers = [...groups.keys()].sort((a, b) => a - b);
  // 同型压制
  const trySame = (): Card[] | null => {
    if (target.type === 'single' || target.type === 'pair' || target.type === 'triple') {
      const need = target.type === 'single' ? 1 : target.type === 'pair' ? 2 : 3;
      for (const p of sortedPowers) {
        if (p > target.power && groups.get(p)!.length >= need && !(groups.get(p)!.length >= 4 && need < 4)) {
          return groups.get(p)!.slice(0, need);
        }
      }
      // 允许拆炸弹压制吗？默认不拆炸弹
      return null;
    }
    if (target.type === 'straight' || target.type === 'pairStraight') {
      const need = target.type === 'straight' ? 1 : 2;
      const len = target.length;
      for (let start = 0; start < sortedPowers.length; start += 1) {
        const seq: number[] = [];
        for (let p = sortedPowers[start]!; groups.has(p) && groups.get(p)!.length >= need; p += 1) {
          seq.push(p);
          if (seq.length === len) break;
        }
        if (seq.length === len && seq[len - 1]! > target.power) {
          if (!cfg.combos.straightWith2 && seq.some((p) => cfg.rankOrder[p] === 2)) continue;
          const out: Card[] = [];
          for (const p of seq) out.push(...groups.get(p)!.slice(0, need));
          return out;
        }
      }
      return null;
    }
    if (target.type === 'bomb') {
      for (const p of sortedPowers) {
        const g = groups.get(p)!;
        if (g.length > target.length || (g.length === target.length && p > target.power && g.length >= 4)) {
          return g.slice(0, Math.max(g.length >= target.length ? target.length : g.length, 4));
        }
      }
      return null;
    }
    return null;
  };
  const same = trySame();
  if (same) return same;
  if (target.type !== 'bomb' && cfg.combos.bombBeatsAny) {
    for (const p of sortedPowers) {
      const g = groups.get(p)!;
      if (g.length >= 4) return g.slice(0, 4);
    }
  }
  return null;
}
