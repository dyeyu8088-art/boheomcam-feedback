/**
 * 水果机结果引擎：CSPRNG 抽停位 → 赔付评估。全部服务端执行，客户端仅播动画。
 */
import type { Rng } from '../rng.js';
import type { SlotPaytableConfig, SlotSymbol } from './config.js';

export interface SpinLineWin {
  lineIndex: number;
  symbol: SlotSymbol;
  count: number;
  multiplier: number;
  win: number;
}

export interface SpinOutcome {
  stops: number[];
  grid: SlotSymbol[][]; // [col][row]
  lineWins: SpinLineWin[];
  scatterCount: number;
  scatterWin: number;
  freeSpinsAwarded: number;
  totalWin: number;
  /** 审计：每列 roll 值（可离线重算验证） */
  rolls: number[];
}

export function spin(cfg: SlotPaytableConfig, betPerLine: number, lineCount: number, rng: Rng, freeSpinMode = false): SpinOutcome {
  const stops: number[] = [];
  const rolls: number[] = [];
  for (let c = 0; c < cfg.columns; c += 1) {
    const strip = cfg.reels[c]!;
    const roll = rng.int(strip.length);
    rolls.push(roll);
    stops.push(roll);
  }
  const grid: SlotSymbol[][] = [];
  for (let c = 0; c < cfg.columns; c += 1) {
    const strip = cfg.reels[c]!;
    const col: SlotSymbol[] = [];
    for (let r = 0; r < cfg.rows; r += 1) col.push(strip[(stops[c]! + r) % strip.length]!);
    grid.push(col);
  }
  return evaluate(cfg, grid, stops, rolls, betPerLine, lineCount, freeSpinMode);
}

export function evaluate(
  cfg: SlotPaytableConfig,
  grid: SlotSymbol[][],
  stops: number[],
  rolls: number[],
  betPerLine: number,
  lineCount: number,
  freeSpinMode: boolean,
): SpinOutcome {
  const lines = cfg.lines.slice(0, lineCount);
  const lineWins: SpinLineWin[] = [];
  const bonusMult = freeSpinMode ? cfg.freeSpinMultiplier : 1;

  for (let li = 0; li < lines.length; li += 1) {
    const rows = lines[li]!;
    const symbols: SlotSymbol[] = [];
    for (let c = 0; c < cfg.columns; c += 1) symbols.push(grid[c]![rows[c]!]!);
    // 确定线首有效符号（Wild 顺延）
    let base: SlotSymbol | null = null;
    for (const s of symbols) {
      if (s === cfg.scatter) break;
      if (s !== cfg.wild) {
        base = s;
        break;
      }
    }
    const effective = base ?? cfg.wild;
    if (effective === cfg.scatter) continue;
    let count = 0;
    for (const s of symbols) {
      if (s === effective || s === cfg.wild) count += 1;
      else break;
    }
    // 纯 Wild 线按 Wild 计
    const paySymbol = base === null ? cfg.wild : effective;
    const pay = cfg.pays[paySymbol]?.[count];
    if (pay && pay > 0) {
      lineWins.push({ lineIndex: li, symbol: paySymbol, count, multiplier: pay, win: pay * betPerLine * bonusMult });
    }
  }

  let scatterCount = 0;
  for (let c = 0; c < cfg.columns; c += 1) {
    for (let r = 0; r < cfg.rows; r += 1) if (grid[c]![r] === cfg.scatter) scatterCount += 1;
  }
  const totalBet = betPerLine * lineCount;
  const scatterWin = (cfg.scatterPays[scatterCount] ?? 0) * totalBet * bonusMult;
  const freeSpinsAwarded = freeSpinMode ? 0 : (cfg.freeSpins[scatterCount] ?? 0);
  const totalWin = lineWins.reduce((s, w) => s + w.win, 0) + scatterWin;
  return { stops, grid, lineWins, scatterCount, scatterWin, freeSpinsAwarded, totalWin, rolls };
}

/** 中奖等级（演出分级用；与竞品分析的演出节奏公式对应） */
export function winTier(totalWin: number, totalBet: number): 'none' | 'normal' | 'big' | 'mega' | 'epic' {
  if (totalWin <= 0) return 'none';
  const x = totalWin / totalBet;
  if (x < 5) return 'normal';
  if (x < 15) return 'big';
  if (x < 50) return 'mega';
  return 'epic';
}
