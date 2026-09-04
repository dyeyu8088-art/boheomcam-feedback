import { describe, expect, it } from 'vitest';
import { FishingRoomEngine } from '../src/fishing/engine.js';
import { FISHING_STAGES, fishTypeById } from '../src/fishing/config.js';
import { secureRng } from '../src/rng.js';

const stage = FISHING_STAGES[0]!;

function engineWithFish(nowMs: number) {
  const e = new FishingRoomEngine(stage);
  const wave = e.nextWaveIfDue(nowMs)!;
  return { e, wave };
}

describe('捕鱼引擎', () => {
  it('波次生成鱼群且有过期时间', () => {
    const { wave } = engineWithFish(1000);
    expect(wave.fish.length).toBeGreaterThan(10);
    for (const f of wave.fish) expect(f.expireAtMs).toBeGreaterThan(f.spawnAtMs);
  });

  it('射击频控：超过 maxFireRate 拒绝', () => {
    const e = new FishingRoomEngine(stage);
    let allowed = 0;
    for (let i = 0; i < 20; i += 1) {
      if (e.checkFireRate(1, 5000 + i * 10)) allowed += 1;
    }
    expect(allowed).toBe(stage.maxFireRate);
    // 窗口滑动后恢复
    expect(e.checkFireRate(1, 7000)).toBe(true);
  });

  it('非法炮倍不在白名单（由宿主校验，配置正确性检查）', () => {
    expect(stage.multipliers).not.toContain(999);
  });

  it('子弹只能消耗一次；他人子弹/不存在的鱼被拒绝', () => {
    const { e, wave } = engineWithFish(1000);
    const fish = wave.fish[0]!;
    const now = fish.spawnAtMs + 100;
    e.registerBullet('b1', 7, 1, now - 50);
    const r1 = e.resolveHit(7, 'b1', fish.fishId, now, secureRng);
    expect(r1.ok).toBe(true);
    const r2 = e.resolveHit(7, 'b1', fish.fishId, now + 10, secureRng);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('BULLET_CONSUMED');
    e.registerBullet('b2', 7, 1, now);
    const r3 = e.resolveHit(8, 'b2', fish.fishId, now, secureRng);
    expect(r3.reason).toBe('BULLET_NOT_YOURS');
    const r4 = e.resolveHit(7, 'b2', 999999, now, secureRng);
    expect(r4.reason).toBe('FISH_NOT_FOUND');
  });

  it('过期子弹与已游走的鱼被拒绝', () => {
    const { e, wave } = engineWithFish(1000);
    const fish = wave.fish[0]!;
    e.registerBullet('b1', 7, 1, 1000);
    const r = e.resolveHit(7, 'b1', fish.fishId, 1000 + 7000, secureRng);
    expect(['BULLET_EXPIRED', 'FISH_GONE']).toContain(r.reason);
  });

  it('RTP 收敛：10 万发对沙丁鱼，赔付率接近目标（±4%）', () => {
    const e = new FishingRoomEngine(stage);
    const sardine = fishTypeById.get('sardine')!;
    let cost = 0;
    let paid = 0;
    for (let i = 0; i < 100_000; i += 1) {
      const nowMs = 1000 + i;
      // 直接驱动内部数学：注册子弹 + 人造活鱼
      e.activeFish.set(i, { fishId: i, typeId: 'sardine', pathId: 0, spawnAtMs: nowMs - 100, speedScale: sardine.speedScale, expireAtMs: nowMs + 10000 });
      e.registerBullet(`b${i}`, 1, 1, nowMs);
      cost += stage.bulletBaseCost;
      const r = e.resolveHit(1, `b${i}`, i, nowMs, secureRng);
      if (r.dead) paid += r.reward;
    }
    const rtp = paid / cost;
    expect(rtp).toBeGreaterThan(stage.targetRtp - 0.04);
    expect(rtp).toBeLessThan(stage.targetRtp + 0.04);
  });

  it('RTP 控制器上下限被夹紧', () => {
    const e = new FishingRoomEngine(stage);
    e.pool = 10_000_000;
    expect(e.rtpFactor).toBeLessThanOrEqual(stage.controller.maxFactor);
    e.pool = -10_000_000;
    expect(e.rtpFactor).toBeGreaterThanOrEqual(stage.controller.minFactor);
  });
});

import { FISH_PATHS, headingOnPath, laneForFish, pathProgress, pointOnPath, pointOnPathLane } from '../src/fishing/paths.js';

describe('鱼群路径库（共享）', () => {
  it('每条路径进度单调不减、首尾闭合、坐标在出入场范围内', () => {
    for (const p of FISH_PATHS) {
      let last = -1;
      for (let i = 0; i <= 200; i += 1) {
        const t = i / 200;
        const u = pathProgress(p, t);
        expect(u).toBeGreaterThanOrEqual(last - 1e-9);
        last = u;
        const [x, y] = pointOnPath(p, t);
        expect(x).toBeGreaterThanOrEqual(-0.2);
        expect(x).toBeLessThanOrEqual(1.2);
        expect(y).toBeGreaterThanOrEqual(-0.2);
        expect(y).toBeLessThanOrEqual(1.2);
      }
      expect(pathProgress(p, 0)).toBe(0);
      expect(pathProgress(p, 1)).toBe(1);
      expect(pointOnPath(p, 0)).toEqual(p.points[0]);
      expect(pointOnPath(p, 1)).toEqual(p.points[p.points.length - 1]);
    }
  });
  it('停留变向路径中段静止且离开方向与进入方向相反', () => {
    const p = FISH_PATHS.find((x) => x.ease === 'pause')!;
    const a = pointOnPath(p, 0.42);
    const b = pointOnPath(p, 0.54);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-9);
    const inA = headingOnPath(p, 0.2).angle;
    const outA = headingOnPath(p, 0.8).angle;
    expect(Math.sign(Math.cos(inA))).not.toBe(Math.sign(Math.cos(outA)));
  });
  it('拐点减速：turns 路径在控制点附近速度低于段中', () => {
    const p = FISH_PATHS.find((x) => x.ease === 'turns' && x.points.length === 5)!;
    const mid = headingOnPath(p, 0.125).speed; // 第一段中点
    const knot = headingOnPath(p, 0.25).speed; // 第一个控制点
    expect(knot).toBeLessThan(mid);
  });
  it('鱼群车道：小鱼 5 条对称车道、大鱼 / Boss 走中线；偏移沿法线且长度等于车道值', () => {
    const lanes = new Set(Array.from({ length: 50 }, (_, i) => laneForFish(i + 1, 'small')));
    expect([...lanes].sort((a, b) => a - b)).toEqual([-0.07, -0.035, 0, 0.035, 0.07]);
    expect(laneForFish(9, 'large')).toBe(0);
    expect(laneForFish(9, 'boss')).toBe(0);
    const p = FISH_PATHS[0]!;
    const [x0, y0] = pointOnPath(p, 0.5);
    const [x1, y1] = pointOnPathLane(p, 0.5, 0.05);
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeCloseTo(0.05, 5);
  });
  it('路径 id 唯一且与 kind 覆盖直线 / 斜向 / 弧 / S / 停留 / 之字 / Boss 环绕', () => {
    const ids = new Set(FISH_PATHS.map((p) => p.pathId));
    expect(ids.size).toBe(FISH_PATHS.length);
    const kinds = new Set(FISH_PATHS.map((p) => p.kind));
    for (const k of ['straight', 'diagonal', 'arc', 's', 'pause', 'zigzag', 'boss-circle', 'boss-arc']) expect(kinds.has(k as never)).toBe(true);
  });
});
