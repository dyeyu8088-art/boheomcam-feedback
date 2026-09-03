/**
 * 轮盘配置（欧式单零 0–36）。全部数值可由后台 game_rules 覆盖；客户端只读取、不决定结果。
 * 金币为游戏内虚拟娱乐资产，不可兑换现金。
 */
export type RouletteBetType = 'straight' | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'dozen' | 'column';

export interface RouletteConfig {
  version: string;
  tableId: string;
  /** 可选筹码面额（与素材表一一对应） */
  chips: number[];
  /** 单注最小 / 单点最大 / 单人单局最大 */
  minBet: number;
  maxBetPerSpot: number;
  maxBetPerRound: number;
  /** 阶段时长（毫秒）：下注窗口 / 转盘演出 / 结果展示 */
  betWindowMs: number;
  spinMs: number;
  resultMs: number;
  /** 净赔率（赢时返还 amount × (odds + 1)） */
  payouts: Record<RouletteBetType, number>;
  historySize: number;
}

export const ROULETTE_V1: RouletteConfig = {
  version: 'roulette_eu_v1',
  tableId: 'main',
  chips: [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  minBet: 10,
  maxBetPerSpot: 1000000,
  maxBetPerRound: 5000000,
  betWindowMs: 30000,
  spinMs: 9000,
  resultMs: 6000,
  payouts: { straight: 35, red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1, dozen: 2, column: 2 },
  historySize: 30,
};

/** 欧式轮盘顺时针号码顺序（仅用于转盘动画定位，结果本身为 0–36 均匀抽样） */
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type RouletteColor = 'green' | 'red' | 'black';
export function colorOf(n: number): RouletteColor {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export const BET_TYPES: RouletteBetType[] = ['straight', 'red', 'black', 'odd', 'even', 'low', 'high', 'dozen', 'column'];
