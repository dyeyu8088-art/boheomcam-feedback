import { describe, expect, it } from 'vitest';
import { STOCK_V1, StockBetError, bandOf, changePct, directionOf, evaluateBet, firstDecimalDigit, gbmStep, lastDecimalDigit, normalizeBet } from '../src/stock/index.js';
import { secureRng, seqRng } from '../src/rng.js';

const cfg = STOCK_V1;

describe('stock engine', () => {
  it('方向与涨跌幅', () => {
    expect(directionOf(100, 100.01)).toBe('UP');
    expect(directionOf(100, 99.99)).toBe('DOWN');
    expect(directionOf(100, 100.004)).toBe('FLAT');
    expect(changePct(100, 100.5)).toBeCloseTo(0.5, 6);
  });
  it('小数位数字', () => {
    expect(firstDecimalDigit(128.37)).toBe(3);
    expect(lastDecimalDigit(128.37)).toBe(7);
    expect(firstDecimalDigit(56.05)).toBe(0);
    expect(lastDecimalDigit(56.1)).toBe(0);
  });
  it('区间划分：左闭右开，0 归 UP1', () => {
    expect(bandOf(cfg, -0.7)?.id).toBe('DN2');
    expect(bandOf(cfg, -0.5)?.id).toBe('DN1');
    expect(bandOf(cfg, 0)?.id).toBe('UP1');
    expect(bandOf(cfg, 0.5)?.id).toBe('UP2');
  });
  it('规范化：HIGHER/LOWER 参考价由服务端当前价写入，数字 / 区间校验', () => {
    const b = normalizeBet(cfg, { type: 'HIGHER', selection: '999', amount: 100 }, { currentPrice: 128.456 });
    expect(b.selection).toBe('128.46');
    expect(b.oddsBp).toBe(19000);
    expect(normalizeBet(cfg, { type: 'UP', selection: 'x', amount: 10 }, { currentPrice: 1 }).selection).toBe('');
    expect(() => normalizeBet(cfg, { type: 'FIRST_DIGIT', selection: '10', amount: 10 }, { currentPrice: 1 })).toThrow(StockBetError);
    expect(() => normalizeBet(cfg, { type: 'RANGE', selection: 'XX', amount: 10 }, { currentPrice: 1 })).toThrow(/区间/);
    expect(() => normalizeBet(cfg, { type: 'UP', selection: '', amount: 5 }, { currentPrice: 1 })).toThrow(/不得低于/);
    expect(() => normalizeBet(cfg, { type: 'SPLIT', selection: '', amount: 50 }, { currentPrice: 1 })).toThrow(/类型/);
    expect(normalizeBet(cfg, { type: 'RANGE', selection: 'UP2', amount: 100 }, { currentPrice: 1 }).oddsBp).toBe(42000);
  });
  it('派彩：UP/DOWN 1.9×，平盘退本金；HIGHER/LOWER 对参考价；数字 9.5×；区间按档赔率', () => {
    const up = normalizeBet(cfg, { type: 'UP', amount: 100 }, { currentPrice: 100 });
    expect(evaluateBet(cfg, up, { openingPrice: 100, settlementPrice: 100.5 })).toBe(190);
    expect(evaluateBet(cfg, up, { openingPrice: 100, settlementPrice: 99.5 })).toBe(0);
    expect(evaluateBet(cfg, up, { openingPrice: 100, settlementPrice: 100 })).toBe(100);
    const lower = normalizeBet(cfg, { type: 'LOWER', amount: 100 }, { currentPrice: 100.2 });
    expect(evaluateBet(cfg, lower, { openingPrice: 100, settlementPrice: 100.1 })).toBe(190);
    expect(evaluateBet(cfg, lower, { openingPrice: 100, settlementPrice: 100.2 })).toBe(100);
    const d = normalizeBet(cfg, { type: 'LAST_DIGIT', selection: '7', amount: 100 }, { currentPrice: 1 });
    expect(evaluateBet(cfg, d, { openingPrice: 100, settlementPrice: 101.37 })).toBe(950);
    expect(evaluateBet(cfg, d, { openingPrice: 100, settlementPrice: 101.38 })).toBe(0);
    const r = normalizeBet(cfg, { type: 'RANGE', selection: 'DN2', amount: 100 }, { currentPrice: 1 });
    expect(evaluateBet(cfg, r, { openingPrice: 100, settlementPrice: 99.3 })).toBe(420);
    expect(evaluateBet(cfg, r, { openingPrice: 100, settlementPrice: 99.6 })).toBe(0);
  });
  it('固定赔率下 UP/DOWN 理论 RTP ≈ 95%（对称行情）', () => {
    // 模拟 4000 回合（30 tick），统计 UP 注的返还率
    let paid = 0;
    let staked = 0;
    for (let i = 0; i < 4000; i += 1) {
      let p = 100;
      for (let t = 0; t < 30; t += 1) p = gbmStep(p, 0.0012, 0, secureRng);
      const bet = normalizeBet(cfg, { type: 'UP', amount: 100 }, { currentPrice: 100 });
      staked += 100;
      paid += evaluateBet(cfg, bet, { openingPrice: 100, settlementPrice: p });
    }
    const rtp = paid / staked;
    expect(rtp).toBeGreaterThan(0.88);
    expect(rtp).toBeLessThan(1.02);
  });
  it('GBM 步进：价格为正、两位小数、可用序列 RNG 复现', () => {
    const a = gbmStep(128, 0.0012, 0, seqRng([0.3, 0.7]));
    const b = gbmStep(128, 0.0012, 0, seqRng([0.3, 0.7]));
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
    expect(Math.round(a * 100) / 100).toBe(a);
  });
});
