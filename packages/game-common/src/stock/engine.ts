/**
 * 股票涨跌引擎：模拟行情（GBM）+ 逐注判定。价格统一保留两位小数。
 */
import type { Rng } from '../rng.js';
import { STOCK_BET_TYPES, type StockBetType, type StockConfig, type StockRangeBand } from './config.js';

export interface StockBet {
  type: StockBetType;
  /** HIGHER/LOWER: 下注时价格（服务端写入）；数字: "0"–"9"；RANGE: 区间 id；UP/DOWN: "" */
  selection: string;
  amount: number;
  /** 赔率（万分比，含本金），下注时锁定 */
  oddsBp: number;
}

export class StockBetError extends Error {
  constructor(
    public readonly reason: 'TYPE' | 'SELECTION' | 'AMOUNT' | 'MIN' | 'ROUND_MAX' | 'INSTRUMENT',
    message: string,
  ) {
    super(message);
  }
}

export type Direction = 'UP' | 'DOWN' | 'FLAT';

export function roundPrice(p: number): number {
  return Math.max(1, Math.round(p * 100) / 100);
}

export function directionOf(open: number, settle: number): Direction {
  const o = roundPrice(open);
  const s = roundPrice(settle);
  return s > o ? 'UP' : s < o ? 'DOWN' : 'FLAT';
}

export function changePct(open: number, settle: number): number {
  return ((roundPrice(settle) - roundPrice(open)) / roundPrice(open)) * 100;
}

/** 小数点后第一位 */
export function firstDecimalDigit(price: number): number {
  return Math.floor(Math.round(roundPrice(price) * 100) / 10) % 10;
}
/** 小数点后第二位（末位） */
export function lastDecimalDigit(price: number): number {
  return Math.round(roundPrice(price) * 100) % 10;
}

export function bandOf(cfg: StockConfig, pct: number): StockRangeBand | undefined {
  return cfg.ranges.find((b) => (b.minPct === null || pct >= b.minPct) && (b.maxPct === null || pct < b.maxPct));
}

export function oddsFor(cfg: StockConfig, type: StockBetType, selection: string): number {
  if (type === 'RANGE') {
    const band = cfg.ranges.find((b) => b.id === selection);
    if (!band) throw new StockBetError('SELECTION', `未知区间 ${selection}`);
    return band.oddsBp;
  }
  return cfg.oddsBp[type];
}

/** 校验并规范化一注（HIGHER/LOWER 的参考价由服务端当前价决定，不信任客户端） */
export function normalizeBet(
  cfg: StockConfig,
  raw: { type: string; selection?: string; amount: number },
  ctx: { currentPrice: number },
): StockBet {
  const type = raw.type as StockBetType;
  if (!STOCK_BET_TYPES.includes(type)) throw new StockBetError('TYPE', `未知投注类型 ${raw.type}`);
  if (!Number.isInteger(raw.amount) || raw.amount <= 0) throw new StockBetError('AMOUNT', '金额不合法');
  if (raw.amount < cfg.minBet) throw new StockBetError('MIN', `单注不得低于 ${cfg.minBet}`);
  let selection = String(raw.selection ?? '');
  switch (type) {
    case 'UP':
    case 'DOWN':
      selection = '';
      break;
    case 'HIGHER':
    case 'LOWER':
      selection = roundPrice(ctx.currentPrice).toFixed(2);
      break;
    case 'FIRST_DIGIT':
    case 'LAST_DIGIT':
      if (!/^[0-9]$/.test(selection)) throw new StockBetError('SELECTION', '数字必须为 0–9');
      break;
    case 'RANGE':
      if (!cfg.ranges.some((b) => b.id === selection)) throw new StockBetError('SELECTION', `未知区间 ${selection}`);
      break;
    default:
      break;
  }
  return { type, selection, amount: raw.amount, oddsBp: oddsFor(cfg, type, selection) };
}

/**
 * 派彩（含本金）：输 0；赢 amount × odds；UP/DOWN 平盘、HIGHER/LOWER 等于参考价 → 退还本金
 */
export function evaluateBet(cfg: StockConfig, bet: StockBet, ctx: { openingPrice: number; settlementPrice: number }): number {
  const win = bet.amount * bet.oddsBp;
  const refund = bet.amount;
  const s = roundPrice(ctx.settlementPrice);
  switch (bet.type) {
    case 'UP':
    case 'DOWN': {
      const d = directionOf(ctx.openingPrice, s);
      if (d === 'FLAT') return refund;
      return d === bet.type ? Math.floor(win / 10000) : 0;
    }
    case 'HIGHER':
    case 'LOWER': {
      const ref = roundPrice(Number(bet.selection));
      if (s === ref) return refund;
      return (bet.type === 'HIGHER' ? s > ref : s < ref) ? Math.floor(win / 10000) : 0;
    }
    case 'FIRST_DIGIT':
      return firstDecimalDigit(s) === Number(bet.selection) ? Math.floor(win / 10000) : 0;
    case 'LAST_DIGIT':
      return lastDecimalDigit(s) === Number(bet.selection) ? Math.floor(win / 10000) : 0;
    case 'RANGE': {
      const band = bandOf(cfg, changePct(ctx.openingPrice, s));
      return band && band.id === bet.selection ? Math.floor(win / 10000) : 0;
    }
    default:
      return 0;
  }
}

/** 几何布朗运动一步（Box–Muller，均匀数来自 CSPRNG） */
export function gbmStep(price: number, sigma: number, drift: number, rng: Rng): number {
  const u1 = (rng.int(2147483647) + 1) / 2147483648;
  const u2 = rng.int(2147483647) / 2147483647;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const next = price * Math.exp(drift - (sigma * sigma) / 2 + sigma * z);
  return roundPrice(next);
}
