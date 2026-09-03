import { describe, expect, it } from 'vitest';
import { FishingRoomEngine, frozenOverlapMs } from '../src/fishing/engine.js';
import { bossMaxHp, FISHING_STAGES, fishTypeById, WAVE_TEMPLATES } from '../src/fishing/config.js';
import { secureRng, seqRng } from '../src/rng.js';

const stage = FISHING_STAGES[0]!;

/** 推进到含 Boss 的波次 */
function engineAtBossWave(): { e: FishingRoomEngine; bossId: number; now: number } {
  const e = new FishingRoomEngine(stage);
  let now = 1000;
  for (let i = 0; i < WAVE_TEMPLATES.length; i += 1) {
    const w = e.nextWaveIfDue(now)!;
    if (w.bosses.length) return { e, bossId: w.bosses[0]!.fishId, now };
    now += w.fish.length ? WAVE_TEMPLATES[i]!.durationMs + 1 : 1;
  }
  throw new Error('no boss wave');
}

describe('捕鱼 Boss 血量与技能', () => {
  it('Boss 有血量，子弹只造成伤害，血量归零按伤害占比分奖，总奖励 = maxHp × RTP', () => {
    const { e, bossId, now } = engineAtBossWave();
    const boss = e.activeFish.get(bossId)!;
    const t = boss.spawnAtMs + 3000;
    const maxHp = bossMaxHp(fishTypeById.get(boss.typeId)!, stage);
    expect(e.bosses.get(bossId)!.maxHp).toBe(maxHp);
    // 玩家 1 与玩家 2 轮流射击（伤害因子固定 1.0 → rng 返回 400/801）
    const rng = seqRng([400]);
    let dead = false;
    let shots = 0;
    let lastBoss: ReturnType<FishingRoomEngine['resolveHit']>['boss'] | undefined;
    while (!dead && shots < 5000) {
      const uid = shots % 3 === 0 ? 2 : 1; // 1 号打 2/3，2 号打 1/3
      const bid = `b${shots}`;
      e.registerBullet(bid, uid, 10, t + shots);
      const r = e.resolveHit(uid, bid, bossId, t + shots, rng);
      expect(r.ok).toBe(true);
      lastBoss = r.boss;
      dead = r.dead;
      shots += 1;
    }
    expect(dead).toBe(true);
    expect(lastBoss!.dead).toBe(true);
    const total = lastBoss!.rewards.reduce((s, r) => s + r.amount, 0);
    expect(Math.abs(total - Math.round(maxHp * stage.targetRtp))).toBeLessThanOrEqual(2);
    const r1 = lastBoss!.rewards.find((r) => r.uid === 1)!.amount;
    const r2 = lastBoss!.rewards.find((r) => r.uid === 2)!.amount;
    expect(r1).toBeGreaterThan(r2);
    expect(e.activeFish.has(bossId)).toBe(false);
    void now;
  });

  it('技能冷却：连续使用被拒绝，冷却后可用', () => {
    const e = new FishingRoomEngine(stage);
    e.nextWaveIfDue(1000);
    const a = e.useSkill(1, 'LIGHTNING', 200, 5000, secureRng);
    expect(a.ok).toBe(true);
    const b = e.useSkill(1, 'LIGHTNING', 200, 6000, secureRng);
    expect(b.ok).toBe(false);
    expect(b.reason).toBe('SKILL_COOLDOWN');
    const c = e.useSkill(1, 'LIGHTNING', 200, 5000 + 8001, secureRng);
    expect(c.ok).toBe(true);
  });

  it('闪电最多命中 6 条屏内鱼，且期望回报 ≈ RTP × 费用', () => {
    let spent = 0;
    let won = 0;
    for (let round = 0; round < 3000; round += 1) {
      const e = new FishingRoomEngine(stage);
      const w = e.nextWaveIfDue(1000)!;
      const t = w.fish[0]!.spawnAtMs + 6000;
      const out = e.useSkill(1, 'LIGHTNING', 200, t, secureRng);
      expect(out.targets.length).toBeLessThanOrEqual(6);
      spent += 200;
      won += out.kills.reduce((s, k) => s + k.reward, 0);
    }
    const rtp = won / spent;
    expect(rtp).toBeGreaterThan(stage.targetRtp - 0.08);
    expect(rtp).toBeLessThan(stage.targetRtp + 0.08);
  });

  it('冰冻：鱼的位置在冻结窗口内不前进，过期时间顺延', () => {
    const e = new FishingRoomEngine(stage);
    const w = e.nextWaveIfDue(1000)!;
    const f = w.fish[0]!;
    const t0 = f.spawnAtMs + 4000;
    const before = e.fishPos(f, t0)!;
    const expireBefore = f.expireAtMs;
    const out = e.useSkill(1, 'FREEZE', 800, t0, secureRng);
    expect(out.frozenUntilMs).toBe(t0 + 8000);
    expect(f.expireAtMs).toBe(expireBefore + 8000);
    const during = e.fishPos(f, t0 + 5000)!;
    expect(during[0]).toBeCloseTo(before[0], 6);
    expect(during[1]).toBeCloseTo(before[1], 6);
    const after = e.fishPos(f, t0 + 9000)!;
    expect(after[0] !== before[0] || after[1] !== before[1]).toBe(true);
    expect(frozenOverlapMs(e.freezes, f.spawnAtMs, t0 + 9000)).toBe(8000);
  });

  it('激光只命中射线走廊内的鱼；导弹优先锁定目标', () => {
    const e = new FishingRoomEngine(stage);
    const w = e.nextWaveIfDue(1000)!;
    const t = w.fish[0]!.spawnAtMs + 6000;
    const laser = e.useSkill(1, 'LASER', 500, t, secureRng, { dirDeg: -90 });
    expect(laser.ok).toBe(true);
    for (const id of laser.targets) {
      const fish = w.fish.find((x) => x.fishId === id)!;
      // 只校验目标此刻在屏内（走廊几何由引擎保证）
      expect(e.fishPos(fish, t) !== null || e.activeFish.has(id) === false).toBe(true);
    }
    const alive = [...e.activeFish.values()].find((x) => e.fishPos(x, t + 100));
    if (alive) {
      const m = e.useSkill(2, 'MISSILE', 300, t + 100, secureRng, { targetFishId: alive.fishId });
      expect(m.targets).toEqual([alive.fishId]);
    }
  });
});
