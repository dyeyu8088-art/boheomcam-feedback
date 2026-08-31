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
