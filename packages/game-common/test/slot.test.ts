import { describe, expect, it } from 'vitest';
import { evaluate, spin, winTier } from '../src/slot/engine.js';
import { FRUIT_GOLD_V1 } from '../src/slot/config.js';
import type { SlotSymbol } from '../src/slot/config.js';
import { secureRng, seqRng } from '../src/rng.js';

const cfg = FRUIT_GOLD_V1;

function gridOf(rows: SlotSymbol[][]): SlotSymbol[][] {
  // rows[r][c] → grid[c][r]
  const grid: SlotSymbol[][] = [];
  for (let c = 0; c < cfg.columns; c += 1) {
    grid.push([rows[0]![c]!, rows[1]![c]!, rows[2]![c]!]);
  }
  return grid;
}

describe('水果机引擎', () => {
  it('确定性停位可复现（审计重放基础）', () => {
    const rolls = [3, 14, 27, 8, 19];
    const a = spin(cfg, 100, 20, seqRng(rolls));
    const b = spin(cfg, 100, 20, seqRng(rolls));
    expect(a.stops).toEqual(rolls);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('中线赔付：中排五连 SEVEN', () => {
    const rows: SlotSymbol[][] = [
      ['CHERRY', 'LEMON', 'ORANGE', 'GRAPE', 'MELON'],
      ['SEVEN', 'SEVEN', 'SEVEN', 'SEVEN', 'SEVEN'],
      ['LEMON', 'ORANGE', 'GRAPE', 'MELON', 'CHERRY'],
    ];
    const out = evaluate(cfg, gridOf(rows), [0, 0, 0, 0, 0], [], 100, 20, false);
    const line0 = out.lineWins.find((w) => w.lineIndex === 0);
    expect(line0).toBeDefined();
    expect(line0!.symbol).toBe('SEVEN');
    expect(line0!.count).toBe(5);
    expect(line0!.win).toBe(cfg.pays.SEVEN![5]! * 100);
  });

  it('Wild 替代成线', () => {
    const rows: SlotSymbol[][] = [
      ['CHERRY', 'LEMON', 'ORANGE', 'GRAPE', 'MELON'],
      ['DIAMOND', 'WILD', 'DIAMOND', 'CHERRY', 'LEMON'],
      ['LEMON', 'ORANGE', 'GRAPE', 'MELON', 'CHERRY'],
    ];
    const out = evaluate(cfg, gridOf(rows), [0, 0, 0, 0, 0], [], 100, 20, false);
    const line0 = out.lineWins.find((w) => w.lineIndex === 0);
    expect(line0).toBeDefined();
    expect(line0!.symbol).toBe('DIAMOND');
    expect(line0!.count).toBe(3);
  });

  it('Scatter 触发免费旋转与总注赔付', () => {
    const rows: SlotSymbol[][] = [
      ['BONUS', 'LEMON', 'BONUS', 'GRAPE', 'BONUS'],
      ['DIAMOND', 'CHERRY', 'DIAMOND', 'CHERRY', 'LEMON'],
      ['LEMON', 'ORANGE', 'GRAPE', 'MELON', 'CHERRY'],
    ];
    const out = evaluate(cfg, gridOf(rows), [0, 0, 0, 0, 0], [], 100, 20, false);
    expect(out.scatterCount).toBe(3);
    expect(out.freeSpinsAwarded).toBe(cfg.freeSpins[3]);
    expect(out.scatterWin).toBe(cfg.scatterPays[3]! * 100 * 20);
  });

  it('免费旋转倍率生效且不重复触发', () => {
    const rows: SlotSymbol[][] = [
      ['BONUS', 'LEMON', 'BONUS', 'GRAPE', 'BONUS'],
      ['DIAMOND', 'WILD', 'DIAMOND', 'CHERRY', 'LEMON'],
      ['LEMON', 'ORANGE', 'GRAPE', 'MELON', 'CHERRY'],
    ];
    const normal = evaluate(cfg, gridOf(rows), [0, 0, 0, 0, 0], [], 100, 20, false);
    const free = evaluate(cfg, gridOf(rows), [0, 0, 0, 0, 0], [], 100, 20, true);
    expect(free.freeSpinsAwarded).toBe(0);
    const nl = normal.lineWins.find((w) => w.lineIndex === 0)!;
    const fl = free.lineWins.find((w) => w.lineIndex === 0)!;
    expect(fl.win).toBe(nl.win * cfg.freeSpinMultiplier);
  });

  it('中奖等级分档', () => {
    expect(winTier(0, 2000)).toBe('none');
    expect(winTier(4000, 2000)).toBe('normal');
    expect(winTier(2000 * 20, 2000)).toBe('mega');
    expect(winTier(2000 * 100, 2000)).toBe('epic');
  });

  it('RTP 蒙特卡洛（30 万转）落在合理区间', () => {
    let bet = 0;
    let win = 0;
    let freeSpinsPending = 0;
    for (let i = 0; i < 300_000; i += 1) {
      if (freeSpinsPending > 0) {
        freeSpinsPending -= 1;
        const out = spin(cfg, 100, 20, secureRng, true);
        win += out.totalWin;
        freeSpinsPending += out.freeSpinsAwarded;
      } else {
        bet += 100 * 20;
        const out = spin(cfg, 100, 20, secureRng, false);
        win += out.totalWin;
        freeSpinsPending += out.freeSpinsAwarded;
      }
    }
    const rtp = win / bet;
    // 精确调参由 scripts/slot-rtp-sim.ts 报告；此处验证不失控
    expect(rtp).toBeGreaterThan(0.8);
    expect(rtp).toBeLessThan(1.05);
  }, 60_000);
});
