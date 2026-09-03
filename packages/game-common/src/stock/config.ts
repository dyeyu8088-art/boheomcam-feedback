/**
 * 股票涨跌玩法配置：全部为虚拟品种（不使用任何真实公司名称 / 商标 / 真实行情），
 * 行情由服务端模拟（几何布朗运动，CSPRNG），客户端只读取、不决定结果。
 * 金币为游戏内虚拟娱乐资产，不可兑换现金。
 */
export type StockBetType = 'UP' | 'DOWN' | 'HIGHER' | 'LOWER' | 'FIRST_DIGIT' | 'LAST_DIGIT' | 'RANGE';

export interface StockInstrument {
  id: string;
  name: string;
  nameKo: string;
  basePrice: number;
  /** 每 tick 对数收益标准差 */
  sigmaPerTick: number;
  /** 每 tick 漂移（0 = 无趋势） */
  driftPerTick: number;
}

export interface StockRangeBand {
  id: string;
  /** 涨跌幅百分比区间 [minPct, maxPct)；null 表示无界 */
  minPct: number | null;
  maxPct: number | null;
  /** 赔率（万分比，含本金） */
  oddsBp: number;
}

export interface StockConfig {
  version: string;
  instruments: StockInstrument[];
  tickMs: number;
  /** 回合总时长（开盘 → 结算），结算即下一回合开盘 */
  roundMs: number;
  /** 结算前多少毫秒锁盘 */
  lockBeforeMs: number;
  chips: number[];
  minBet: number;
  maxBetPerRound: number;
  /** 固定赔率（万分比，含本金） */
  oddsBp: Record<Exclude<StockBetType, 'RANGE'>, number>;
  ranges: StockRangeBand[];
  /** 进场时下发的历史 tick 数 */
  historyTicks: number;
  /** 保留在数据库中的 tick 时长（毫秒） */
  tickRetentionMs: number;
}

export const STOCK_V1: StockConfig = {
  version: 'stock_sim_v1',
  instruments: [
    { id: 'YB_TECH', name: '延吉科技', nameKo: '옌지 테크', basePrice: 128.0, sigmaPerTick: 0.0012, driftPerTick: 0 },
    { id: 'CB_SPRING', name: '长白山泉', nameKo: '백두산 샘물', basePrice: 56.5, sigmaPerTick: 0.0012, driftPerTick: 0 },
    { id: 'TM_SHIP', name: '图们江航运', nameKo: '두만강 해운', basePrice: 23.8, sigmaPerTick: 0.0012, driftPerTick: 0 },
  ],
  tickMs: 1000,
  roundMs: 30000,
  lockBeforeMs: 8000,
  chips: [10, 50, 100, 500, 1000, 5000, 10000],
  minBet: 10,
  maxBetPerRound: 500000,
  // UP/DOWN/HIGHER/LOWER ≈ 50% → 1.9×；小数位数字 ≈ 10% → 9.5×（庄家优势 5%）
  oddsBp: { UP: 19000, DOWN: 19000, HIGHER: 19000, LOWER: 19000, FIRST_DIGIT: 95000, LAST_DIGIT: 95000 },
  // 每回合 30 tick，σ_round ≈ 0.66%：|r|>0.5% ≈ 22.4%（公平 4.46×）、0<r<0.5% ≈ 27.6%（公平 3.62×）
  ranges: [
    { id: 'DN2', minPct: null, maxPct: -0.5, oddsBp: 42000 },
    { id: 'DN1', minPct: -0.5, maxPct: 0, oddsBp: 34000 },
    { id: 'UP1', minPct: 0, maxPct: 0.5, oddsBp: 34000 },
    { id: 'UP2', minPct: 0.5, maxPct: null, oddsBp: 42000 },
  ],
  historyTicks: 150,
  tickRetentionMs: 86400000,
};

export const STOCK_BET_TYPES: StockBetType[] = ['UP', 'DOWN', 'HIGHER', 'LOWER', 'FIRST_DIGIT', 'LAST_DIGIT', 'RANGE'];
