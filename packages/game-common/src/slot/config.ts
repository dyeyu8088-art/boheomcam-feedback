/**
 * 水果机（虚拟积分娱乐）数学配置。
 * 卷轴条方案：每列一条符号序列，符号出现频次决定命中率；RTP 由 scripts/slot-rtp-sim.ts 蒙特卡洛验证。
 */

export type SlotSymbol = 'CHERRY' | 'LEMON' | 'ORANGE' | 'GRAPE' | 'MELON' | 'DIAMOND' | 'SEVEN' | 'GOLD' | 'WILD' | 'BONUS';

export interface SlotPaytableConfig {
  paytableVersion: string;
  reelVersion: string;
  columns: number;
  rows: number;
  /** 每列卷轴条 */
  reels: SlotSymbol[][];
  /** 赔付线（每线按列给出行号） */
  lines: number[][];
  /** symbol → {连续个数: 倍率(×每线注)} */
  pays: Record<string, Record<number, number>>;
  wild: SlotSymbol;
  scatter: SlotSymbol;
  /** scatter 个数 → 总注倍率 */
  scatterPays: Record<number, number>;
  /** scatter 个数 → 免费次数 */
  freeSpins: Record<number, number>;
  /** 免费旋转内奖励倍率 */
  freeSpinMultiplier: number;
  betOptions: number[];
  targetRtp: number;
}

const R = (s: string): SlotSymbol[] => s.split(' ') as SlotSymbol[];

/**
 * 默认赔付表 fruit_gold_v2（5×3，20线）：v2 仅把符号更名为新版美术（BELL→DIAMOND、CROWN→GOLD、SCATTER→BONUS），数学不变。
 * 目标 RTP ≈ 96%（发布前必须跑 slot-rtp-sim 验证并把结果写入 config_versions）。
 */
export const FRUIT_GOLD_V2: SlotPaytableConfig = {
  paytableVersion: 'fruit_gold_v2',
  reelVersion: 'fruit_gold_reels_v2',
  columns: 5,
  rows: 3,
  reels: [
    R('CHERRY LEMON ORANGE GRAPE CHERRY MELON LEMON DIAMOND ORANGE CHERRY GRAPE LEMON SEVEN ORANGE MELON CHERRY LEMON GRAPE WILD ORANGE DIAMOND CHERRY MELON LEMON BONUS GRAPE ORANGE CHERRY GOLD LEMON MELON GRAPE'),
    R('LEMON CHERRY GRAPE ORANGE MELON CHERRY LEMON DIAMOND GRAPE ORANGE CHERRY SEVEN LEMON MELON ORANGE GRAPE WILD CHERRY LEMON BONUS ORANGE MELON DIAMOND GRAPE CHERRY LEMON GOLD ORANGE GRAPE MELON CHERRY LEMON'),
    R('ORANGE GRAPE CHERRY LEMON MELON DIAMOND ORANGE CHERRY GRAPE LEMON SEVEN MELON ORANGE WILD CHERRY GRAPE LEMON BONUS ORANGE MELON CHERRY DIAMOND GRAPE LEMON GOLD ORANGE CHERRY MELON GRAPE LEMON WILD ORANGE'),
    R('GRAPE MELON LEMON CHERRY ORANGE DIAMOND GRAPE LEMON CHERRY MELON SEVEN ORANGE GRAPE WILD LEMON CHERRY BONUS MELON ORANGE GRAPE DIAMOND LEMON CHERRY GOLD MELON ORANGE GRAPE LEMON CHERRY MELON ORANGE'),
    R('MELON ORANGE CHERRY GRAPE LEMON DIAMOND MELON CHERRY ORANGE GRAPE SEVEN LEMON MELON WILD CHERRY ORANGE BONUS GRAPE LEMON MELON DIAMOND CHERRY ORANGE GOLD GRAPE LEMON MELON CHERRY ORANGE GRAPE LEMON'),
  ],
  lines: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0],
    [1, 0, 1, 2, 1],
    [1, 2, 1, 0, 1],
    [0, 1, 1, 1, 2],
    [2, 1, 1, 1, 0],
    [1, 1, 0, 1, 1],
    [1, 1, 2, 1, 1],
    [0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2],
    [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1],
    [0, 2, 0, 2, 0],
    [2, 0, 2, 0, 2],
    [1, 0, 2, 0, 1],
  ],
  // RTP 实测（scripts/slot-rtp-sim.ts, 400k spins）：总 96.8% ≈ 目标 96%（线奖82.5% + Scatter3.6% + 免费旋转10.7%）
  pays: {
    CHERRY: { 3: 10, 4: 20, 5: 50 },
    LEMON: { 3: 10, 4: 20, 5: 50 },
    ORANGE: { 3: 16, 4: 30, 5: 80 },
    GRAPE: { 3: 16, 4: 30, 5: 80 },
    MELON: { 3: 20, 4: 50, 5: 120 },
    DIAMOND: { 3: 30, 4: 80, 5: 200 },
    SEVEN: { 3: 50, 4: 160, 5: 500 },
    GOLD: { 3: 80, 4: 240, 5: 1000 },
    WILD: { 3: 100, 4: 400, 5: 2000 },
  },
  wild: 'WILD',
  scatter: 'BONUS',
  scatterPays: { 3: 4, 4: 20, 5: 100 },
  freeSpins: { 3: 8, 4: 12, 5: 20 },
  freeSpinMultiplier: 2,
  betOptions: [100, 200, 500, 1000, 2000, 5000],
  targetRtp: 0.96,
};

/** 兼容别名（旧引用） */
export const FRUIT_GOLD_V1 = FRUIT_GOLD_V2;
