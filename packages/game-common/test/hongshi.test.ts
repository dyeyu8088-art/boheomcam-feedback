import { describe, expect, it } from 'vitest';
import { HongshiTable } from '../src/hongshi/table.js';
import { HONGSHI_DRAFT_RULE, validateHongshiRule } from '../src/hongshi/config.js';
import { beats, parseCombo } from '../src/hongshi/combos.js';
import { makeCard, SUIT_CLUB, SUIT_DIAMOND, SUIT_HEART, SUIT_SPADE } from '../src/hongshi/cards.js';
import { secureRng } from '../src/rng.js';

const cfg = HONGSHI_DRAFT_RULE;
const SEATS = [0, 1, 2, 3];

describe('红十牌型', () => {
  it('单张/对子/三张/顺子/连对/炸弹解析', () => {
    expect(parseCombo([makeCard(SUIT_HEART, 5)], cfg)?.type).toBe('single');
    expect(parseCombo([makeCard(SUIT_HEART, 5), makeCard(SUIT_SPADE, 5)], cfg)?.type).toBe('pair');
    expect(parseCombo([makeCard(SUIT_HEART, 5), makeCard(SUIT_SPADE, 5), makeCard(SUIT_CLUB, 5)], cfg)?.type).toBe('triple');
    const straight = [3, 4, 5, 6, 7].map((r) => makeCard(SUIT_HEART, r));
    expect(parseCombo(straight, cfg)?.type).toBe('straight');
    const pairStraight = [3, 3, 4, 4, 5, 5].map((r, i) => makeCard(i % 2 === 0 ? SUIT_HEART : SUIT_SPADE, r));
    expect(parseCombo(pairStraight, cfg)?.type).toBe('pairStraight');
    const bomb = [SUIT_DIAMOND, SUIT_CLUB, SUIT_HEART, SUIT_SPADE].map((s) => makeCard(s, 9));
    expect(parseCombo(bomb, cfg)?.type).toBe('bomb');
  });

  it('非法牌型返回 null（顺子含2 / 长度不足 / 杂牌）', () => {
    expect(parseCombo([makeCard(SUIT_HEART, 1), makeCard(SUIT_HEART, 2)].concat([3, 4, 5].map((r) => makeCard(SUIT_CLUB, r))), cfg)).toBeNull();
    expect(parseCombo([3, 4, 5, 6].map((r) => makeCard(SUIT_HEART, r)), cfg)).toBeNull();
    expect(parseCombo([makeCard(SUIT_HEART, 3), makeCard(SUIT_CLUB, 7)], cfg)).toBeNull();
  });

  it('大小比较：2 最大；炸弹压一切；大炸弹压小炸弹', () => {
    const three = parseCombo([makeCard(SUIT_HEART, 3)], cfg)!;
    const two = parseCombo([makeCard(SUIT_HEART, 2)], cfg)!;
    expect(beats(three, two, cfg)).toBe(true);
    expect(beats(two, three, cfg)).toBe(false);
    const bomb9 = parseCombo([SUIT_DIAMOND, SUIT_CLUB, SUIT_HEART, SUIT_SPADE].map((s) => makeCard(s, 9)), cfg)!;
    expect(beats(two, bomb9, cfg)).toBe(true);
    const bombK = parseCombo([SUIT_DIAMOND, SUIT_CLUB, SUIT_HEART, SUIT_SPADE].map((s) => makeCard(s, 13)), cfg)!;
    expect(beats(bomb9, bombK, cfg)).toBe(true);
    expect(beats(bombK, bomb9, cfg)).toBe(false);
  });

  it('配置校验', () => {
    expect(validateHongshiRule(cfg)).toEqual([]);
    const bad = structuredClone(cfg);
    bad.score.rankPoints = [2, 1, 1, -2];
    expect(validateHongshiRule(bad).length).toBeGreaterThan(0);
  });
});

describe('红十桌', () => {
  it('发牌 13×4，红十座位识别', () => {
    const t = new HongshiTable(cfg, SEATS, 0, 10, secureRng);
    t.start();
    for (const s of SEATS) expect(t.p(s).hand.length).toBe(13);
    expect(t.redSeats.length).toBeGreaterThanOrEqual(1);
    expect(t.redSeats.length).toBeLessThanOrEqual(2);
  });

  it('非法出牌被拒绝：不是回合 / 压不过 / 非法牌型 / 出别人的牌', () => {
    const t = new HongshiTable(cfg, SEATS, 0, 10, secureRng);
    t.start();
    const other = SEATS.find((s) => s !== t.turnSeat)!;
    expect(() => t.play(other, [t.p(other).hand[0]!])).toThrow(/NOT_YOUR_TURN/);
    const cur = t.turnSeat;
    const notMine = t.p(other).hand[0]!;
    expect(() => t.play(cur, [notMine])).toThrow(/card not in hand/);
    expect(() => t.pass(cur)).toThrow(/leader must play/);
  });

  it('打出红十立即亮明身份', () => {
    const t = new HongshiTable(cfg, SEATS, 0, 10, secureRng);
    t.start();
    const redSeat = t.redSeats[0]!;
    // 强制轮到红十持有者并让其出红十
    t.turnSeat = redSeat;
    t.tableCombo = null;
    const redCard = t.p(redSeat).hand.find((c) => cfg.identityCards.includes(c))!;
    t.play(redSeat, [redCard]);
    expect(t.p(redSeat).identityRevealed).toBe(true);
    expect(t.events.some((e) => e.type === 'identityReveal')).toBe(true);
  });

  it('模糊测试：随机 100 局跑完，分数零和、名次完整', () => {
    for (let i = 0; i < 100; i += 1) {
      const t = new HongshiTable(cfg, SEATS, null, 10, secureRng);
      t.start();
      let guard = 0;
      while (t.phase !== 'finished') {
        guard += 1;
        if (guard > 3000) throw new Error('hongshi game stuck');
        t.autoAct(t.turnSeat);
      }
      const r = t.result!;
      expect(Object.values(r.scoreChanges).reduce((a, b) => a + b, 0)).toBe(0);
      expect(new Set(r.ranks.map((x) => x.rank))).toEqual(new Set([1, 2, 3, 4]));
      expect(r.multiplier).toBeGreaterThanOrEqual(1);
      expect(r.multiplier).toBeLessThanOrEqual(cfg.score.maxMultiplier);
    }
  });
});
