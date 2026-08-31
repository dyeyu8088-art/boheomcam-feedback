import { describe, expect, it } from 'vitest';
import { MahjongTable } from '../src/mahjong/table.js';
import { YANBIAN_DRAFT_RULE } from '../src/mahjong/config.js';
import { kindOf } from '../src/mahjong/tiles.js';
import { secureRng, seqRng } from '../src/rng.js';

const cfg = YANBIAN_DRAFT_RULE;
const SEATS = [0, 1, 2, 3];

function newTable(rng = secureRng) {
  return new MahjongTable(cfg, SEATS, 0, 10, rng);
}

/** 随机策略打完一局（模拟托管），返回 table */
function playOut(table: MahjongTable): MahjongTable {
  table.start();
  let guard = 0;
  while (table.phase !== 'finished') {
    guard += 1;
    if (guard > 2000) throw new Error('game did not finish');
    if (table.phase === 'turn') {
      table.autoActTurn(table.turnSeat);
    } else if (table.phase === 'claiming') {
      for (const c of [...table.claims]) {
        if (!c.responded) table.autoRespond(c.seat);
      }
    }
  }
  return table;
}

describe('MahjongTable', () => {
  it('发牌后各家 13 张、庄家 14 张，墙数守恒', () => {
    const t = newTable();
    t.start();
    expect(t.p(0).hand.length).toBe(14);
    for (const s of [1, 2, 3]) expect(t.p(s).hand.length).toBe(13);
    const total = t.wall.length + SEATS.reduce((n, s) => n + t.p(s).hand.length, 0);
    expect(total).toBe(108); // 万条筒 27 kind × 4
  });

  it('非当前回合出牌被拒绝', () => {
    const t = newTable();
    t.start();
    expect(() => t.discard(1, t.p(1).hand[0]!)).toThrow(/NOT_YOUR_TURN/);
  });

  it('打不在手中的牌被拒绝', () => {
    const t = newTable();
    t.start();
    const notInHand = t.wall[0]!;
    expect(() => t.discard(0, notInHand)).toThrow(/tile not in hand/);
  });

  it('重复响应动作窗口被拒绝', () => {
    // 构造双响应窗口：座位1 可碰、座位3 听胡同一张 → 座位1 先过，再次响应必须被拒
    const t = newTable();
    t.start();
    const discardTile = t.p(0).hand[0]!;
    const k = kindOf(discardTile);
    const copies = [0, 1, 2, 3].map((c) => k * 4 + c).filter((x) => x !== discardTile);
    t.p(1).hand[0] = copies[0]!;
    t.p(1).hand[1] = copies[1]!;
    const pool: number[] = [];
    const pairKinds = [0, 2, 6, 9, 12, 18, 22].filter((x) => x !== k).slice(0, 6);
    for (const pk of pairKinds) pool.push(pk * 4, pk * 4 + 1);
    pool.push(copies[2]!);
    t.p(3).hand = pool;
    t.discard(0, discardTile);
    expect(t.phase).toBe('claiming');
    expect(t.claims.length).toBeGreaterThanOrEqual(2);
    t.respondClaim(1, { action: 'pass' });
    expect(t.phase).toBe('claiming'); // 座位3 未响应，窗口仍开
    expect(() => t.respondClaim(1, { action: 'pass' })).toThrow(/already responded/);
  });

  it('碰后轮到碰家出牌', () => {
    const t = newTable();
    t.start();
    const discardTile = t.p(0).hand[0]!;
    const k = kindOf(discardTile);
    const copies = [0, 1, 2, 3].map((c) => k * 4 + c).filter((x) => x !== discardTile);
    t.p(2).hand[0] = copies[0]!;
    t.p(2).hand[1] = copies[1]!;
    t.discard(0, discardTile);
    expect(t.phase).toBe('claiming');
    for (const c of [...t.claims]) {
      if (c.seat === 2) t.respondClaim(2, { action: 'peng' });
      else t.respondClaim(c.seat, { action: 'pass' });
    }
    expect(t.turnSeat).toBe(2);
    expect(t.p(2).melds[0]!.type).toBe('peng');
    expect(t.p(0).discards.length).toBe(0); // 被碰走
    // 碰家必须出牌
    const out = t.p(2).hand[0]!;
    t.discard(2, out);
  });

  it('胡优先于碰（Action Priority Engine）', () => {
    const t = newTable();
    t.start();
    // 庄家打 5万(kind 4)；座位1 可碰；座位3 听 5万 平胡
    const dealer = t.p(0);
    const target = dealer.hand.find((x) => true)!;
    const k = kindOf(target);
    if (k > 30) return; // 理论不可能（无字牌）
    const otherCopies = [0, 1, 2, 3].map((c) => k * 4 + c).filter((x) => x !== target);
    t.p(1).hand[0] = otherCopies[0]!;
    t.p(1).hand[1] = otherCopies[1]!;
    // 座位3 白盒改成听 k 的手牌：k±结构复杂，直接用 七对差一张
    const pool: number[] = [];
    const pushPair = (kk: number) => pool.push(kk * 4, kk * 4 + 1);
    const pairKinds = [0, 2, 6, 9, 12, 18, 22].filter((x) => x !== k).slice(0, 6);
    for (const pk of pairKinds) pushPair(pk);
    pool.push(k * 4 + (otherCopies[2]! % 4)); // 第 13 张：k 单张
    t.p(3).hand = pool;
    t.discard(0, target);
    expect(t.phase).toBe('claiming');
    const seat3Offer = t.claims.find((c) => c.seat === 3);
    expect(seat3Offer?.options.some((o) => o.action === 'hu')).toBe(true);
    for (const c of [...t.claims]) {
      if (c.seat === 3) t.respondClaim(3, { action: 'hu' });
      else if (c.options.some((o) => o.action === 'peng')) t.respondClaim(c.seat, { action: 'peng' });
      else t.respondClaim(c.seat, { action: 'pass' });
    }
    expect(t.phase).toBe('finished');
    expect(t.result!.winners[0]!.seat).toBe(3);
    expect(t.result!.loserSeat).toBe(0);
    // 点炮者独付
    expect(t.result!.scoreChanges[0]).toBeLessThan(0);
    expect(t.result!.scoreChanges[3]).toBeGreaterThan(0);
  });

  it('动作窗口超时按过处理并继续', () => {
    const t = newTable();
    t.start();
    const target = t.p(0).hand[0]!;
    const k = kindOf(target);
    const copies = [0, 1, 2, 3].map((c) => k * 4 + c).filter((x) => x !== target);
    t.p(1).hand[0] = copies[0]!;
    t.p(1).hand[1] = copies[1]!;
    t.discard(0, target);
    if (t.phase === 'claiming') {
      t.timeoutClaims();
    }
    expect(t.phase).toBe('turn');
    expect(t.turnSeat).toBe(1); // 无人要牌 → 下家摸牌
  });

  it('模糊测试：随机 80 局全部正常结束且分数零和', () => {
    for (let i = 0; i < 80; i += 1) {
      const t = playOut(newTable());
      const r = t.result!;
      const sum = Object.values(r.scoreChanges).reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
      // 回放事件流完整
      expect(t.events[t.events.length - 1]!.type).toBe('roundEnd');
      const seqs = t.events.map((e) => e.seq);
      for (let j = 1; j < seqs.length; j += 1) expect(seqs[j]).toBe(seqs[j - 1]! + 1);
    }
  });

  it('确定性 RNG 可复现同一局（回放基础）', () => {
    const rngValues = Array.from({ length: 500 }, (_, i) => (i * 7919) % 104729);
    const t1 = playOut(new MahjongTable(cfg, SEATS, 0, 10, seqRng(rngValues)));
    const t2 = playOut(new MahjongTable(cfg, SEATS, 0, 10, seqRng(rngValues)));
    expect(JSON.stringify(t1.events)).toBe(JSON.stringify(t2.events));
  });
});
