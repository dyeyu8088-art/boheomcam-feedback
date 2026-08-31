/**
 * MahjongHandEvaluator — 服务端权威胡牌判定与算番。
 * 牌型模块化：基础型（互斥取最大番）+ 加成型（累加），全部由规则配置开关与配番。
 */
import type { MahjongRuleConfig } from './config.js';
import {
  countByKind,
  isDragonKind,
  isHonorKind,
  isTerminalOrHonor,
  kindOf,
  rankOfKind,
  suitOfKind,
  SUIT_HONOR,
  type Tile,
  type TileKind,
} from './tiles.js';

export interface Meld {
  type: 'chi' | 'peng' | 'minggang' | 'angang' | 'bugang';
  kinds: TileKind[]; // chi: 3 个连续 kind；其余为同 kind 重复
  fromSeat?: number;
}

export interface HuContext {
  /** 手牌（含刚摸/待胡那张） */
  handTiles: Tile[];
  melds: Meld[];
  winKind: TileKind;
  selfDraw: boolean;
  /** 场景加成标记 */
  isTianHu?: boolean;
  isDiHu?: boolean;
  isGangShangKaiHua?: boolean;
  isHaiDi?: boolean;
  isQiangGang?: boolean;
  isGangHouPao?: boolean;
  declaredTing?: boolean;
}

export interface HuResult {
  ok: boolean;
  fan: number;
  cappedFan: number;
  multiplier: number;
  patterns: { id: string; fan: number }[];
  reason?: string;
}

/** 标准 4 面子 + 1 将 分解（回溯） */
export function canFormStandard(counts: Int8Array): boolean {
  // 找将
  for (let k = 0; k < 34; k += 1) {
    if (counts[k]! >= 2) {
      counts[k] = (counts[k]! - 2) as never;
      if (decomposeSets(counts, 0)) {
        counts[k] = (counts[k]! + 2) as never;
        return true;
      }
      counts[k] = (counts[k]! + 2) as never;
    }
  }
  return false;
}

function decomposeSets(counts: Int8Array, start: number): boolean {
  let k = start;
  while (k < 34 && counts[k] === 0) k += 1;
  if (k >= 34) return true;
  const c = counts[k]!;
  // 刻子
  if (c >= 3) {
    counts[k] = (c - 3) as never;
    if (decomposeSets(counts, k)) {
      counts[k] = c as never;
      return true;
    }
    counts[k] = c as never;
  }
  // 顺子（仅序数牌，且不跨门）
  if (k < 27 && rankOfKind(k) <= 7 && counts[k + 1]! > 0 && counts[k + 2]! > 0) {
    counts[k] = (counts[k]! - 1) as never;
    counts[k + 1] = (counts[k + 1]! - 1) as never;
    counts[k + 2] = (counts[k + 2]! - 1) as never;
    const ok = decomposeSets(counts, k);
    counts[k] = (counts[k]! + 1) as never;
    counts[k + 1] = (counts[k + 1]! + 1) as never;
    counts[k + 2] = (counts[k + 2]! + 1) as never;
    if (ok) return true;
  }
  return false;
}

/** 七对（可配豪华七对：含4张算2对） */
function isQiDui(counts: Int8Array): { ok: boolean; hasFour: boolean } {
  let pairs = 0;
  let hasFour = false;
  for (let k = 0; k < 34; k += 1) {
    const c = counts[k]!;
    if (c === 1 || c === 3) return { ok: false, hasFour: false };
    if (c === 2) pairs += 1;
    if (c === 4) {
      pairs += 2;
      hasFour = true;
    }
  }
  return { ok: pairs === 7, hasFour };
}

/** 十三幺：全部幺九字各一 + 任一成对 */
function isShiSanYao(counts: Int8Array): boolean {
  const required: TileKind[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let pairFound = false;
  let total = 0;
  for (let k = 0; k < 34; k += 1) {
    const c = counts[k]!;
    total += c;
    if (c === 0) continue;
    if (!required.includes(k)) return false;
    if (c === 2) pairFound = true;
    else if (c !== 1) return false;
  }
  return total === 14 && pairFound;
}

/** 碰碰胡：无顺子分解（全部刻子 + 将），meld 中不能有吃 */
function isPengPengHu(counts: Int8Array, melds: Meld[]): boolean {
  if (melds.some((m) => m.type === 'chi')) return false;
  for (let k = 0; k < 34; k += 1) {
    if (counts[k]! >= 2) {
      counts[k] = (counts[k]! - 2) as never;
      let ok = true;
      for (let j = 0; j < 34 && ok; j += 1) {
        if (counts[j]! % 3 !== 0) ok = false;
      }
      counts[k] = (counts[k]! + 2) as never;
      if (ok) return true;
    }
  }
  return false;
}

function allKinds(ctx: HuContext): TileKind[] {
  const kinds = ctx.handTiles.map(kindOf);
  for (const m of ctx.melds) kinds.push(...m.kinds);
  return kinds;
}

function suitsUsed(kinds: TileKind[]): Set<number> {
  return new Set(kinds.map(suitOfKind));
}

/**
 * 判定是否可胡并算番。
 * 返回 ok=false 时 reason 说明失败原因（未成型 / 未达起胡番 / 缺门等约束）。
 */
export function evaluateHu(ctx: HuContext, cfg: MahjongRuleConfig): HuResult {
  const fail = (reason: string): HuResult => ({ ok: false, fan: 0, cappedFan: 0, multiplier: 0, patterns: [], reason });
  const counts = countByKind(ctx.handTiles);
  const totalTiles = ctx.handTiles.length + ctx.melds.reduce((n, m) => n + (m.type === 'chi' || m.type === 'peng' ? 3 : 3), 0);
  // 手牌 + 副露必须构成 14 张结构（杠按刻子计入 3）
  if ((totalTiles - 14) % 3 !== 0 && totalTiles !== 14) {
    return fail(`牌数结构异常: ${totalTiles}`);
  }

  const qidui = ctx.melds.length === 0 ? isQiDui(counts) : { ok: false, hasFour: false };
  const ssy = ctx.melds.length === 0 && cfg.patterns.shisanyao.enabled ? isShiSanYao(counts) : false;
  const standard = canFormStandard(counts);
  if (!standard && !qidui.ok && !ssy) return fail('未成胡型');

  // 结构约束
  const kinds = allKinds(ctx);
  if (cfg.hu.requireMenQing && ctx.melds.some((m) => m.type !== 'angang')) return fail('需门清');
  if (cfg.hu.requireQueMen) {
    const numberSuits = new Set(kinds.filter((k) => !isHonorKind(k)).map(suitOfKind));
    if (numberSuits.size >= 3) return fail('需缺一门');
  }
  if (cfg.hu.requireYaoJiu && !kinds.some(isTerminalOrHonor)) return fail('需含幺九');
  if (cfg.hu.require258Jiang && standard && !qidui.ok && !ssy) {
    if (!hasJiang258(counts)) return fail('需2/5/8将');
  }
  if (ctx.selfDraw === false && !cfg.hu.allowDianPaoHu) return fail('仅可自摸');
  if (cfg.hu.selfDrawOnly && !ctx.selfDraw) return fail('仅可自摸');

  const patterns: { id: string; fan: number }[] = [];
  const p = cfg.patterns;

  // ── 基础型（互斥，取最大） ──
  const base: { id: string; fan: number }[] = [];
  if (ssy) base.push({ id: 'shisanyao', fan: p.shisanyao.fan });
  if (qidui.ok && p.qidui.enabled) {
    if (qidui.hasFour && p.haoqidui.enabled) base.push({ id: 'haoqidui', fan: p.haoqidui.fan });
    else base.push({ id: 'qidui', fan: p.qidui.fan });
  }
  if (standard) {
    if (p.pengpenghu.enabled && isPengPengHu(counts, ctx.melds)) base.push({ id: 'pengpenghu', fan: p.pengpenghu.fan });
    if (base.length === 0 || p.pinghu.enabled) base.push({ id: 'pinghu', fan: p.pinghu.fan });
  }
  if (base.length === 0) return fail('无可用基础牌型（配置关闭）');
  base.sort((a, b) => b.fan - a.fan);
  patterns.push(base[0]!);

  // ── 花色型（可与基础型叠加） ──
  const suits = suitsUsed(kinds);
  const hasHonor = suits.has(SUIT_HONOR);
  const numberSuitCount = [...suits].filter((s) => s !== SUIT_HONOR).length;
  if (p.ziyise.enabled && hasHonor && numberSuitCount === 0) {
    patterns.push({ id: 'ziyise', fan: p.ziyise.fan });
  } else if (p.qingyise.enabled && !hasHonor && numberSuitCount === 1) {
    patterns.push({ id: 'qingyise', fan: p.qingyise.fan });
  } else if (p.hunyise.enabled && hasHonor && numberSuitCount === 1) {
    patterns.push({ id: 'hunyise', fan: p.hunyise.fan });
  }

  // ── 加成型（累加） ──
  const menQing = ctx.melds.every((m) => m.type === 'angang');
  if (p.quanqiuren.enabled && ctx.handTiles.length <= 2 && !ctx.selfDraw) {
    patterns.push({ id: 'quanqiuren', fan: p.quanqiuren.fan });
  }
  if (p.menqingBonus.enabled && menQing) patterns.push({ id: 'menqing', fan: p.menqingBonus.fan });
  if (p.selfDrawBonus.enabled && ctx.selfDraw) patterns.push({ id: 'zimo', fan: p.selfDrawBonus.fan });
  if (ctx.isTianHu && cfg.hu.tianHu.enabled) patterns.push({ id: 'tianhu', fan: cfg.hu.tianHu.fan });
  if (ctx.isDiHu && cfg.hu.diHu.enabled) patterns.push({ id: 'dihu', fan: cfg.hu.diHu.fan });
  if (ctx.isGangShangKaiHua && cfg.hu.gangShangKaiHua.enabled) {
    patterns.push({ id: 'gangshangkaihua', fan: cfg.hu.gangShangKaiHua.bonusFan });
  }
  if (ctx.isHaiDi && cfg.hu.haiDi.enabled) patterns.push({ id: 'haidi', fan: cfg.hu.haiDi.bonusFan });
  if (ctx.isQiangGang && cfg.actions.qiangGangHu) patterns.push({ id: 'qianggang', fan: 1 });
  if (ctx.isGangHouPao && cfg.hu.gangHouPao.mode === 'bonusFan') {
    patterns.push({ id: 'ganghoupao', fan: cfg.hu.gangHouPao.bonusFan });
  }
  if (ctx.declaredTing && cfg.actions.declareTing.enabled) {
    patterns.push({ id: 'baoting', fan: cfg.actions.declareTing.bonusFan });
  }

  const fan = patterns.reduce((s, x) => s + x.fan, 0);
  if (fan < cfg.hu.minFan) return fail(`未达起胡番(${cfg.hu.minFan})`);
  const cappedFan = Math.min(fan, cfg.score.maxFan);
  const multiplier = 2 ** cappedFan;
  return { ok: true, fan, cappedFan, multiplier, patterns };
}

function hasJiang258(counts: Int8Array): boolean {
  for (let k = 0; k < 27; k += 1) {
    const r = rankOfKind(k);
    if ((r === 2 || r === 5 || r === 8) && counts[k]! >= 2) {
      counts[k] = (counts[k]! - 2) as never;
      const ok = decomposeSets(counts, 0);
      counts[k] = (counts[k]! + 2) as never;
      if (ok) return true;
    }
  }
  return false;
}

/** 听牌检测：手牌 3n+1 张时，返回可胡的 kind 列表 */
export function tingKinds(handTiles: Tile[], melds: Meld[], cfg: MahjongRuleConfig): TileKind[] {
  const result: TileKind[] = [];
  const enabled: TileKind[] = [];
  if (cfg.tiles.useWan) for (let k = 0; k < 9; k += 1) enabled.push(k);
  if (cfg.tiles.useTiao) for (let k = 9; k < 18; k += 1) enabled.push(k);
  if (cfg.tiles.useTong) for (let k = 18; k < 27; k += 1) enabled.push(k);
  if (cfg.tiles.useWinds) for (let k = 27; k < 31; k += 1) enabled.push(k);
  if (cfg.tiles.useDragons) for (let k = 31; k < 34; k += 1) enabled.push(k);
  for (const k of enabled) {
    const trial = [...handTiles, k * 4];
    const r = evaluateHu(
      { handTiles: trial, melds, winKind: k, selfDraw: true },
      // 听牌判定不受 minFan 之外的场景加成影响；用宽松 ctx
      cfg,
    );
    if (r.ok) result.push(k);
  }
  return result;
}
