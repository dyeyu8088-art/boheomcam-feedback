/**
 * 轮盘结果引擎：CSPRNG 抽号 → 逐注判定赔付。服务端执行；客户端只播转盘动画。
 */
import type { Rng } from '../rng.js';
import { BET_TYPES, colorOf, type RouletteBetType, type RouletteConfig } from './config.js';

export interface RouletteBet {
  type: RouletteBetType;
  /** straight: "0".."36"；dozen/column: "1".."3"；其它: "" */
  selection: string;
  amount: number;
}

export class RouletteBetError extends Error {
  constructor(
    public readonly reason: 'TYPE' | 'SELECTION' | 'AMOUNT' | 'MIN' | 'SPOT_MAX' | 'ROUND_MAX' | 'COUNT',
    message: string,
  ) {
    super(message);
  }
}

export function validateBet(cfg: RouletteConfig, bet: RouletteBet): void {
  if (!BET_TYPES.includes(bet.type)) throw new RouletteBetError('TYPE', `未知投注类型 ${String(bet.type)}`);
  if (!Number.isInteger(bet.amount) || bet.amount <= 0) throw new RouletteBetError('AMOUNT', '金额不合法');
  if (bet.amount < cfg.minBet) throw new RouletteBetError('MIN', `单注不得低于 ${cfg.minBet}`);
  if (bet.amount > cfg.maxBetPerSpot) throw new RouletteBetError('SPOT_MAX', `单点不得超过 ${cfg.maxBetPerSpot}`);
  const sel = String(bet.selection ?? '');
  if (bet.type === 'straight') {
    const n = Number(sel);
    if (!/^\d{1,2}$/.test(sel) || n < 0 || n > 36) throw new RouletteBetError('SELECTION', '单号必须为 0–36');
  } else if (bet.type === 'dozen' || bet.type === 'column') {
    if (!['1', '2', '3'].includes(sel)) throw new RouletteBetError('SELECTION', '打/列必须为 1–3');
  } else if (sel !== '') {
    throw new RouletteBetError('SELECTION', '该投注类型不带选项');
  }
}

/** 同类型同选项合并，便于限额与落库 */
export function normalizeBets(bets: RouletteBet[]): RouletteBet[] {
  const map = new Map<string, RouletteBet>();
  for (const b of bets) {
    const key = `${b.type}:${b.selection}`;
    const cur = map.get(key);
    if (cur) cur.amount += b.amount;
    else map.set(key, { type: b.type, selection: b.selection, amount: b.amount });
  }
  return [...map.values()];
}

export function betWins(bet: RouletteBet, result: number): boolean {
  switch (bet.type) {
    case 'straight':
      return Number(bet.selection) === result;
    case 'red':
      return colorOf(result) === 'red';
    case 'black':
      return colorOf(result) === 'black';
    case 'odd':
      return result !== 0 && result % 2 === 1;
    case 'even':
      return result !== 0 && result % 2 === 0;
    case 'low':
      return result >= 1 && result <= 18;
    case 'high':
      return result >= 19 && result <= 36;
    case 'dozen':
      return result !== 0 && Math.ceil(result / 12) === Number(bet.selection);
    case 'column':
      return result !== 0 && ((result - 1) % 3) + 1 === Number(bet.selection);
    default:
      return false;
  }
}

/** 赢时返还总额（含本金），输为 0 */
export function betPayout(cfg: RouletteConfig, bet: RouletteBet, result: number): number {
  return betWins(bet, result) ? bet.amount * (cfg.payouts[bet.type] + 1) : 0;
}

export interface DrawOutcome {
  result: number;
  /** 审计：原始 roll（0–36 均匀） */
  roll: number;
}

export function drawResult(rng: Rng): DrawOutcome {
  const roll = rng.int(37);
  return { result: roll, roll };
}

export interface SettleOutcome {
  payouts: number[];
  totalBet: number;
  totalPayout: number;
}

export function settleBets(cfg: RouletteConfig, bets: RouletteBet[], result: number): SettleOutcome {
  const payouts = bets.map((b) => betPayout(cfg, b, result));
  return {
    payouts,
    totalBet: bets.reduce((s, b) => s + b.amount, 0),
    totalPayout: payouts.reduce((s, p) => s + p, 0),
  };
}
