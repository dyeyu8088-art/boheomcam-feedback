import { describe, expect, it } from 'vitest';
import { ROULETTE_V1, WHEEL_ORDER, betPayout, betWins, colorOf, drawResult, normalizeBets, settleBets, validateBet, RouletteBetError } from '../src/roulette/index.js';
import { seqRng } from '../src/rng.js';

describe('roulette engine', () => {
  it('轮盘顺序覆盖 0–36 且不重复', () => {
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
  });
  it('颜色：0 绿，红黑各 18', () => {
    expect(colorOf(0)).toBe('green');
    const reds = Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => colorOf(n) === 'red').length;
    expect(reds).toBe(18);
  });
  it('单号 35:1、红黑 1:1、打 2:1（含本金返还）', () => {
    expect(betPayout(ROULETTE_V1, { type: 'straight', selection: '17', amount: 100 }, 17)).toBe(3600);
    expect(betPayout(ROULETTE_V1, { type: 'straight', selection: '17', amount: 100 }, 18)).toBe(0);
    expect(betPayout(ROULETTE_V1, { type: 'red', selection: '', amount: 100 }, 1)).toBe(200);
    expect(betPayout(ROULETTE_V1, { type: 'dozen', selection: '2', amount: 100 }, 13)).toBe(300);
    expect(betPayout(ROULETTE_V1, { type: 'column', selection: '1', amount: 100 }, 4)).toBe(300);
  });
  it('0 让所有外围注全输', () => {
    for (const type of ['red', 'black', 'odd', 'even', 'low', 'high'] as const) {
      expect(betWins({ type, selection: '', amount: 10 }, 0)).toBe(false);
    }
    expect(betWins({ type: 'dozen', selection: '1', amount: 10 }, 0)).toBe(false);
    expect(betWins({ type: 'straight', selection: '0', amount: 10 }, 0)).toBe(true);
  });
  it('单号注 37 个结果的总返还 = 36 × 注额（RTP 97.3%）', () => {
    let total = 0;
    for (let r = 0; r <= 36; r += 1) total += betPayout(ROULETTE_V1, { type: 'straight', selection: '5', amount: 100 }, r);
    expect(total).toBe(3600);
    let red = 0;
    for (let r = 0; r <= 36; r += 1) red += betPayout(ROULETTE_V1, { type: 'red', selection: '', amount: 100 }, r);
    expect(red).toBe(3600);
  });
  it('校验：类型 / 选项 / 金额 / 限额', () => {
    expect(() => validateBet(ROULETTE_V1, { type: 'split' as never, selection: '', amount: 10 })).toThrow(RouletteBetError);
    expect(() => validateBet(ROULETTE_V1, { type: 'straight', selection: '37', amount: 10 })).toThrow(/0–36/);
    expect(() => validateBet(ROULETTE_V1, { type: 'red', selection: '1', amount: 10 })).toThrow(/不带选项/);
    expect(() => validateBet(ROULETTE_V1, { type: 'red', selection: '', amount: 5 })).toThrow(/不得低于/);
    expect(() => validateBet(ROULETTE_V1, { type: 'red', selection: '', amount: 1.5 })).toThrow(/不合法/);
    expect(() => validateBet(ROULETTE_V1, { type: 'dozen', selection: '4', amount: 10 })).toThrow(/1–3/);
    expect(() => validateBet(ROULETTE_V1, { type: 'straight', selection: '7', amount: 100 })).not.toThrow();
  });
  it('合并同点位注 + 结算汇总', () => {
    const bets = normalizeBets([
      { type: 'straight', selection: '7', amount: 100 },
      { type: 'straight', selection: '7', amount: 50 },
      { type: 'black', selection: '', amount: 200 },
    ]);
    expect(bets).toHaveLength(2);
    const s = settleBets(ROULETTE_V1, bets, 7);
    expect(s.totalBet).toBe(350);
    expect(s.totalPayout).toBe(150 * 36);
  });
  it('抽号使用 rng.int(37) 且可审计', () => {
    const d = drawResult(seqRng([0.5]));
    expect(d.result).toBeGreaterThanOrEqual(0);
    expect(d.result).toBeLessThanOrEqual(36);
    expect(d.roll).toBe(d.result);
  });
});
