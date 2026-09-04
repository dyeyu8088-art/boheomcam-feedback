/**
 * 水果机（虚拟积分娱乐）数学配置。
 * 卷轴条方案：每列一条符号序列，符号出现频次决定命中率；RTP 由 scripts/slot-rtp-sim.ts 蒙特卡洛验证。
 */

export type SlotSymbol = 'CHERRY' | 'LEMON' | 'ORANGE' | 'GRAPE' | 'MELON' | 'BAR' | 'DIAMOND' | 'SEVEN' | 'GOLD' | 'WILD' | 'BONUS';

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
 * 默认赔付表 fruit_gold_v3（5×3，20线）：
 *   v2 把符号更名为新版美术（BELL→DIAMOND、CROWN→GOLD、SCATTER→BONUS）；
 *   v3 新增 BAR（每列卷轴条第 2、5 个 LEMON 位置改为 BAR，赔率介于 MELON 与 DIAMOND 之间），其余数学不变。
 * 目标 RTP ≈ 96%（发布前必须跑 slot-rtp-sim 验证并把结果写入 config_versions）。
 */
export const FRUIT_GOLD_V3: SlotPaytableConfig = {
  paytableVersion: 'fruit_gold_v3',
  reelVersion: 'fruit_gold_reels_v3',
  columns: 5,
  rows: 3,
  reels: [
    R('CHERRY LEMON ORANGE GRAPE CHERRY MELON BAR DIAMOND ORANGE CHERRY GRAPE LEMON SEVEN ORANGE MELON CHERRY LEMON GRAPE WILD ORANGE DIAMOND CHERRY MELON BAR BONUS GRAPE ORANGE CHERRY GOLD LEMON MELON GRAPE'),
    R('LEMON CHERRY GRAPE ORANGE MELON CHERRY BAR DIAMOND GRAPE ORANGE CHERRY SEVEN LEMON MELON ORANGE GRAPE WILD CHERRY LEMON BONUS ORANGE MELON DIAMOND GRAPE CHERRY BAR GOLD ORANGE GRAPE MELON CHERRY LEMON'),
    R('ORANGE GRAPE CHERRY LEMON MELON DIAMOND ORANGE CHERRY GRAPE BAR SEVEN MELON ORANGE WILD CHERRY GRAPE LEMON BONUS ORANGE MELON CHERRY DIAMOND GRAPE LEMON GOLD ORANGE CHERRY MELON GRAPE BAR WILD ORANGE'),
    R('GRAPE MELON LEMON CHERRY ORANGE DIAMOND GRAPE BAR CHERRY MELON SEVEN ORANGE GRAPE WILD LEMON CHERRY BONUS MELON ORANGE GRAPE DIAMOND LEMON CHERRY GOLD MELON ORANGE GRAPE BAR CHERRY MELON ORANGE'),
    R('MELON ORANGE CHERRY GRAPE LEMON DIAMOND MELON CHERRY ORANGE GRAPE SEVEN BAR MELON WILD CHERRY ORANGE BONUS GRAPE LEMON MELON DIAMOND CHERRY ORANGE GOLD GRAPE LEMON MELON CHERRY ORANGE GRAPE BAR'),
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
  // v3 RTP 实测（scripts/slot-rtp-sim.ts, 600k spins）：总 95.63% ≈ 目标 96%（线奖 81.7% + Scatter 3.6% + 免费旋转 10.4%，命中率 48.0%）
  //   BAR 挤占 LEMON 位置后线奖下降，全表赔率上调约 7% 补回；v2 实测 96.8%（线奖 82.5% + Scatter 3.6% + 免费 10.7%）
  pays: {
    CHERRY: { 3: 11, 4: 22, 5: 55 },
    LEMON: { 3: 11, 4: 22, 5: 55 },
    ORANGE: { 3: 17, 4: 32, 5: 85 },
    GRAPE: { 3: 17, 4: 32, 5: 85 },
    MELON: { 3: 21, 4: 54, 5: 130 },
    BAR: { 3: 26, 4: 65, 5: 160 },
    DIAMOND: { 3: 32, 4: 85, 5: 215 },
    SEVEN: { 3: 54, 4: 170, 5: 540 },
    GOLD: { 3: 85, 4: 255, 5: 1070 },
    WILD: { 3: 107, 4: 430, 5: 2140 },
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
export const FRUIT_GOLD_V2 = FRUIT_GOLD_V3;
export const FRUIT_GOLD_V1 = FRUIT_GOLD_V3;
