/**
 * 捕鱼房间引擎（纯逻辑）：波次时间轴、命中判定（RTP 池控制器）、射击频控。
 * 宿主注入 nowMs 与 Rng；金币扣入账由宿主经 wallet 完成（先扣费→fireOk→命中判定→入账）。
 */
import { chance, type Rng } from '../rng.js';
import { fishTypeById, WAVE_TEMPLATES, type FishingStageConfig, type WaveTemplate } from './config.js';
import { fishPositionAt, pathById } from './paths.js';

export interface ActiveFish {
  fishId: number;
  typeId: string;
  pathId: number;
  spawnAtMs: number;
  speedScale: number;
  expireAtMs: number;
}

export interface FireRecord {
  bulletId: string;
  seatUid: number;
  multiplier: number;
  cost: number;
  firedAtMs: number;
  consumed: boolean;
}

export interface HitOutcome {
  ok: boolean;
  reason?: string;
  dead: boolean;
  reward: number;
  odds: number;
  rtpFactor: number;
  roll?: number;
}

export class FishingRoomEngine {
  readonly stage: FishingStageConfig;
  private fishSeq = 0;
  activeFish = new Map<number, ActiveFish>();
  /** 盈亏池：+ 表示玩家净投入（庄盈），- 表示玩家净赢 */
  pool = 0;
  private fireWindows = new Map<number, number[]>(); // uid -> 最近射击时间戳
  bullets = new Map<string, FireRecord>();
  currentWave: { template: WaveTemplate; startedAtMs: number } | null = null;
  private waveIdx = 0;

  constructor(stage: FishingStageConfig) {
    this.stage = stage;
  }

  /** 推进波次；返回需广播的新一波（含逐条鱼实例），无则 null */
  nextWaveIfDue(nowMs: number): { waveId: string; isBoss: boolean; fish: ActiveFish[] } | null {
    if (this.currentWave && nowMs < this.currentWave.startedAtMs + this.currentWave.template.durationMs) return null;
    const template = WAVE_TEMPLATES[this.waveIdx % WAVE_TEMPLATES.length]!;
    this.waveIdx += 1;
    this.currentWave = { template, startedAtMs: nowMs };
    const spawned: ActiveFish[] = [];
    for (const sp of template.spawns) {
      const type = fishTypeById.get(sp.typeId);
      const path = pathById.get(sp.pathId);
      if (!type || !path) continue;
      for (let i = 0; i < sp.count; i += 1) {
        this.fishSeq += 1;
        const spawnAtMs = nowMs + sp.delayMs + i * sp.gapMs;
        const fish: ActiveFish = {
          fishId: this.fishSeq,
          typeId: sp.typeId,
          pathId: sp.pathId,
          spawnAtMs,
          speedScale: type.speedScale,
          expireAtMs: spawnAtMs + Math.ceil(path.durationMs / type.speedScale),
        };
        this.activeFish.set(fish.fishId, fish);
        spawned.push(fish);
      }
    }
    // 清理已游走的鱼
    for (const [id, f] of this.activeFish) {
      if (f.expireAtMs < nowMs) this.activeFish.delete(id);
    }
    return { waveId: template.waveId, isBoss: !!template.isBossWave, fish: spawned };
  }

  /** 射击频控：滑动窗口（1s） */
  checkFireRate(uid: number, nowMs: number): boolean {
    const win = this.fireWindows.get(uid) ?? [];
    const fresh = win.filter((t) => nowMs - t < 1000);
    if (fresh.length >= this.stage.maxFireRate) {
      this.fireWindows.set(uid, fresh);
      return false;
    }
    fresh.push(nowMs);
    this.fireWindows.set(uid, fresh);
    return true;
  }

  registerBullet(bulletId: string, uid: number, multiplier: number, nowMs: number): FireRecord {
    const cost = this.stage.bulletBaseCost * multiplier;
    const rec: FireRecord = { bulletId, seatUid: uid, multiplier, cost, firedAtMs: nowMs, consumed: false };
    this.bullets.set(bulletId, rec);
    this.pool += cost;
    // 只保留近 30 秒子弹，防内存膨胀
    if (this.bullets.size > 4096) {
      for (const [id, b] of this.bullets) {
        if (nowMs - b.firedAtMs > 30000) this.bullets.delete(id);
      }
    }
    return rec;
  }

  get rtpFactor(): number {
    const c = this.stage.controller;
    // 池为正（庄盈）→ 提高玩家命中；池为负 → 降低
    const steps = Math.trunc(this.pool / c.poolStep);
    const f = 1 + steps * c.factorStep;
    return Math.min(c.maxFactor, Math.max(c.minFactor, f));
  }

  /**
   * 命中判定：校验子弹/鱼/时间窗后按 RTP 概率决定死亡。
   * 服务器权威：客户端只是提交“视觉上命中了”，最终以此判定为准。
   */
  resolveHit(uid: number, bulletId: string, fishId: number, nowMs: number, rng: Rng): HitOutcome {
    const fail = (reason: string): HitOutcome => ({ ok: false, reason, dead: false, reward: 0, odds: 0, rtpFactor: this.rtpFactor });
    const bullet = this.bullets.get(bulletId);
    if (!bullet) return fail('BULLET_NOT_FOUND');
    if (bullet.seatUid !== uid) return fail('BULLET_NOT_YOURS');
    if (bullet.consumed) return fail('BULLET_CONSUMED');
    if (nowMs - bullet.firedAtMs > 6000) return fail('BULLET_EXPIRED');
    const fish = this.activeFish.get(fishId);
    if (!fish) return fail('FISH_NOT_FOUND');
    if (nowMs < fish.spawnAtMs - 500 || nowMs > fish.expireAtMs + 500) return fail('FISH_GONE');
    const path = pathById.get(fish.pathId)!;
    const pos = fishPositionAt(path, fish.spawnAtMs, fish.speedScale, Math.min(nowMs, fish.expireAtMs));
    if (!pos) return fail('FISH_OFFSCREEN');

    bullet.consumed = true;
    const type = fishTypeById.get(fish.typeId)!;
    const targetRtp = this.stage.targetRtp;
    const p = Math.min(0.98, (targetRtp / type.baseOdds) * this.rtpFactor);
    const RES = 1_000_000_000;
    const roll = rng.int(RES);
    const dead = roll < Math.round(p * RES);
    if (!dead) {
      return { ok: true, dead: false, reward: 0, odds: type.baseOdds, rtpFactor: this.rtpFactor, roll };
    }
    const reward = Math.round(bullet.cost * type.baseOdds);
    this.pool -= reward;
    this.activeFish.delete(fishId);
    return { ok: true, dead: true, reward, odds: type.baseOdds, rtpFactor: this.rtpFactor, roll };
  }
}
