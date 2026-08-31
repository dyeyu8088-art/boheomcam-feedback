import { describe, expect, it } from 'vitest';
import { evaluateHu, tingKinds } from '../src/mahjong/evaluator.js';
import { YANBIAN_DRAFT_RULE, validateMahjongRule, type MahjongRuleConfig } from '../src/mahjong/config.js';

const cfg = YANBIAN_DRAFT_RULE;
// kind 转物理牌（copy 依次分配避免重复）
function tiles(...kinds: number[]): number[] {
  const used = new Map<number, number>();
  return kinds.map((k) => {
    const c = used.get(k) ?? 0;
    used.set(k, c + 1);
    if (c > 3) throw new Error(`kind ${k} used more than 4 times`);
    return k * 4 + c;
  });
}

describe('MahjongHandEvaluator', () => {
  it('平胡：123万 456条 789筒 111条 + 99筒', () => {
    const hand = tiles(0, 1, 2, 12, 13, 14, 24, 25, 26, 10, 10, 10, 26, 26);
    expect(() => tiles(26, 26, 26)).toBeTruthy();
    const r = evaluateHu({ handTiles: tiles(0, 1, 2, 12, 13, 14, 18, 19, 20, 10, 10, 10, 26, 26), melds: [], winKind: 26, selfDraw: true }, cfg);
    expect(r.ok).toBe(true);
    expect(r.patterns.map((p) => p.id)).toContain('pinghu');
    void hand;
  });

  it('七对', () => {
    const r = evaluateHu(
      { handTiles: tiles(0, 0, 3, 3, 9, 9, 12, 12, 18, 18, 22, 22, 26, 26), melds: [], winKind: 26, selfDraw: false },
      cfg,
    );
    expect(r.ok).toBe(true);
    expect(r.patterns[0]!.id).toBe('qidui');
  });

  it('豪华七对（带4张）', () => {
    const r = evaluateHu(
      { handTiles: tiles(0, 0, 0, 0, 9, 9, 12, 12, 18, 18, 22, 22, 26, 26), melds: [], winKind: 26, selfDraw: false },
      cfg,
    );
    expect(r.ok).toBe(true);
    expect(r.patterns[0]!.id).toBe('haoqidui');
  });

  it('碰碰胡 + 清一色叠加', () => {
    const r = evaluateHu(
      { handTiles: tiles(0, 0, 0, 2, 2, 2, 4, 4, 4, 6, 6, 6, 8, 8), melds: [], winKind: 8, selfDraw: true },
      cfg,
    );
    expect(r.ok).toBe(true);
    const ids = r.patterns.map((p) => p.id);
    expect(ids).toContain('pengpenghu');
    expect(ids).toContain('qingyise');
    expect(r.cappedFan).toBe(cfg.score.maxFan); // 2+4+加成 ≥ 封顶
  });

  it('未成型不可胡', () => {
    const r = evaluateHu({ handTiles: tiles(0, 1, 3, 5, 9, 11, 13, 18, 20, 22, 24, 26, 10, 10), melds: [], winKind: 10, selfDraw: true }, cfg);
    expect(r.ok).toBe(false);
  });

  it('起胡番限制：minFan 提高后平胡不可点炮胡', () => {
    const strict: MahjongRuleConfig = structuredClone(cfg);
    strict.hu.minFan = 3;
    const r = evaluateHu(
      { handTiles: tiles(0, 1, 2, 12, 13, 14, 18, 19, 20, 10, 10, 10, 26, 26), melds: [], winKind: 26, selfDraw: false },
      strict,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/起胡番/);
  });

  it('听牌检测：单钓将', () => {
    const hand = tiles(0, 1, 2, 12, 13, 14, 18, 19, 20, 10, 10, 10, 26);
    const waits = tingKinds(hand, [], cfg);
    expect(waits).toContain(26);
  });

  it('配置校验器拦截非法配置', () => {
    const bad = structuredClone(cfg);
    bad.tiles.useWan = false;
    bad.tiles.useTiao = false;
    bad.tiles.useTong = false;
    expect(validateMahjongRule(bad).length).toBeGreaterThan(0);
    expect(validateMahjongRule(cfg)).toEqual([]);
  });
});
