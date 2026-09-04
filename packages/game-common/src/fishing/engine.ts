/**
 * 捕鱼房间引擎（纯逻辑）：波次时间轴、命中判定（RTP 池控制器）、射击频控、Boss 血量、技能、冰冻。
 * 宿主注入 nowMs 与 Rng；金币扣入账由宿主经 wallet 完成（先扣费→fireOk→命中判定→入账）。
 * 服务器权威：客户端只提交"视觉上命中 / 想用技能"，是否死亡、奖励多少全由本引擎决定。
 */
import type { Rng } from '../rng.js';
import { bossMaxHp, fishTypeById, skillById, WAVE_TEMPLATES, type FishingStageConfig, type SkillId, type WaveTemplate } from './config.js';
import { fishPositionAt, laneForFish, pathById } from './paths.js';

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

export interface BossState {
  fishId: number;
  hp: number;
  maxHp: number;
  /** 各玩家累计伤害（用于按占比分奖） */
  damage: Map<number, number>;
}

export interface BossOutcome {
  fishId: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  /** 死亡时按伤害占比分配的奖励 */
  rewards: { uid: number; amount: number }[];
}

export interface HitOutcome {
  ok: boolean;
  reason?: string;
  dead: boolean;
  reward: number;
  odds: number;
  rtpFactor: number;
  roll?: number;
  boss?: BossOutcome;
}

export interface SkillKill {
  fishId: number;
  typeId: string;
  reward: number;
  roll: number;
}

export interface SkillOutcome {
  ok: boolean;
  reason?: string;
  skill: SkillId;
  cost: number;
  /** 命中过的目标（含未击杀，用于表现） */
  targets: number[];
  kills: SkillKill[];
  boss?: BossOutcome;
  frozenUntilMs?: number;
  lockUntilMs?: number;
  cooldownUntilMs: number;
  rtpFactor: number;
}

export interface FreezeWindow {
  startMs: number;
  endMs: number;
}

/** 区间 [sinceMs, nowMs] 内被冰冻的总毫秒数（服务端与客户端共用，保证位置一致） */
export function frozenOverlapMs(windows: FreezeWindow[], sinceMs: number, nowMs: number): number {
  let total = 0;
  for (const w of windows) {
    const a = Math.max(sinceMs, w.startMs);
    const b = Math.min(nowMs, w.endMs);
    if (b > a) total += b - a;
  }
  return total;
}

export class FishingRoomEngine {
  readonly stage: FishingStageConfig;
  private fishSeq = 0;
  activeFish = new Map<number, ActiveFish>();
  bosses = new Map<number, BossState>();
  /** 盈亏池：+ 表示玩家净投入（庄盈），- 表示玩家净赢 */
  pool = 0;
  private fireWindows = new Map<number, number[]>(); // uid -> 最近射击时间戳
  bullets = new Map<string, FireRecord>();
  currentWave: { template: WaveTemplate; startedAtMs: number } | null = null;
  private waveIdx = 0;
  /** 冰冻窗口（保留最近 8 段） */
  freezes: FreezeWindow[] = [];
  private cooldowns = new Map<number, Map<SkillId, number>>();

  constructor(stage: FishingStageConfig) {
    this.stage = stage;
  }

  /** 推进波次；返回需广播的新一波（含逐条鱼实例），无则 null */
  nextWaveIfDue(nowMs: number): { waveId: string; isBoss: boolean; fish: ActiveFish[]; bosses: { fishId: number; maxHp: number }[] } | null {
    if (this.currentWave && nowMs < this.currentWave.startedAtMs + this.currentWave.template.durationMs) return null;
    const template = WAVE_TEMPLATES[this.waveIdx % WAVE_TEMPLATES.length]!;
    this.waveIdx += 1;
    this.currentWave = { template, startedAtMs: nowMs };
    const spawned: ActiveFish[] = [];
    const bosses: { fishId: number; maxHp: number }[] = [];
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
        if (type.size === 'boss') {
          const maxHp = bossMaxHp(type, this.stage);
          this.bosses.set(fish.fishId, { fishId: fish.fishId, hp: maxHp, maxHp, damage: new Map() });
          bosses.push({ fishId: fish.fishId, maxHp });
        }
      }
    }
    // 清理已游走的鱼
    for (const [id, f] of this.activeFish) {
      if (f.expireAtMs < nowMs) {
        this.activeFish.delete(id);
        this.bosses.delete(id);
      }
    }
    return { waveId: template.waveId, isBoss: !!template.isBossWave, fish: spawned, bosses };
  }

  /** 鱼在 nowMs 的归一化位置（考虑冰冻暂停）；不在屏内返回 null */
  fishPos(fish: ActiveFish, nowMs: number): [number, number] | null {
    const path = pathById.get(fish.pathId);
    if (!path) return null;
    const frozen = frozenOverlapMs(this.freezes, fish.spawnAtMs, nowMs);
    const size = fishTypeById.get(fish.typeId)?.size ?? 'small';
    return fishPositionAt(path, fish.spawnAtMs, fish.speedScale, Math.min(nowMs - frozen, fish.expireAtMs), laneForFish(fish.fishId, size));
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

  /** 单目标击杀判定（普通鱼）：p = targetRtp / odds × rtpFactor；奖励 = 虚拟子弹成本 × 赔率 */
  private rollKill(typeId: string, virtualCost: number, rng: Rng): { dead: boolean; reward: number; roll: number; odds: number } {
    const type = fishTypeById.get(typeId)!;
    const p = Math.min(0.98, (this.stage.targetRtp / type.baseOdds) * this.rtpFactor);
    const RES = 1_000_000_000;
    const roll = rng.int(RES);
    const dead = roll < Math.round(p * RES);
    const reward = dead ? Math.round(virtualCost * type.baseOdds) : 0;
    return { dead, reward, roll, odds: type.baseOdds };
  }

  /** Boss 伤害：cost × [0.6,1.4]；血量归零按伤害占比分奖（总奖励 = maxHp × targetRtp） */
  private damageBoss(boss: BossState, uid: number, cost: number, rng: Rng): BossOutcome {
    const factor = 0.6 + rng.int(801) / 1000;
    const dmg = Math.max(1, Math.round(cost * factor));
    boss.hp = Math.max(0, boss.hp - dmg);
    boss.damage.set(uid, (boss.damage.get(uid) ?? 0) + dmg);
    if (boss.hp > 0) return { fishId: boss.fishId, hp: boss.hp, maxHp: boss.maxHp, dead: false, rewards: [] };
    const total = Math.round(boss.maxHp * this.stage.targetRtp);
    const sum = [...boss.damage.values()].reduce((a, b) => a + b, 0) || 1;
    const rewards = [...boss.damage.entries()].map(([u, d]) => ({ uid: u, amount: Math.floor((total * d) / sum) })).filter((r) => r.amount > 0);
    this.pool -= rewards.reduce((a, r) => a + r.amount, 0);
    this.activeFish.delete(boss.fishId);
    this.bosses.delete(boss.fishId);
    return { fishId: boss.fishId, hp: 0, maxHp: boss.maxHp, dead: true, rewards };
  }

  /**
   * 命中判定：校验子弹/鱼/时间窗后按 RTP 概率决定死亡；Boss 走血量伤害路径。
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
    if (!this.fishPos(fish, nowMs)) return fail('FISH_OFFSCREEN');

    bullet.consumed = true;
    const type = fishTypeById.get(fish.typeId)!;
    const boss = this.bosses.get(fishId);
    if (boss) {
      const out = this.damageBoss(boss, uid, bullet.cost, rng);
      const mine = out.rewards.find((r) => r.uid === uid)?.amount ?? 0;
      return { ok: true, dead: out.dead, reward: mine, odds: type.baseOdds, rtpFactor: this.rtpFactor, boss: out };
    }
    const r = this.rollKill(fish.typeId, bullet.cost, rng);
    if (!r.dead) return { ok: true, dead: false, reward: 0, odds: r.odds, rtpFactor: this.rtpFactor, roll: r.roll };
    this.pool -= r.reward;
    this.activeFish.delete(fishId);
    return { ok: true, dead: true, reward: r.reward, odds: r.odds, rtpFactor: this.rtpFactor, roll: r.roll };
  }

  cooldownUntil(uid: number, skill: SkillId): number {
    return this.cooldowns.get(uid)?.get(skill) ?? 0;
  }

  /** 屏内活鱼（按位置） */
  private onScreen(nowMs: number): { fish: ActiveFish; pos: [number, number] }[] {
    const out: { fish: ActiveFish; pos: [number, number] }[] = [];
    for (const f of this.activeFish.values()) {
      const pos = this.fishPos(f, nowMs);
      if (pos) out.push({ fish: f, pos });
    }
    return out;
  }

  /**
   * 技能判定。费用由宿主先行扣除（道具或金币）；这里只做目标选择、RTP 判定与奖励计算。
   * 每个目标的"虚拟子弹成本" = cost / 目标数，保证技能总期望回报 = targetRtp × cost。
   */
  useSkill(uid: number, skill: SkillId, cost: number, nowMs: number, rng: Rng, opts: { targetFishId?: number; dirDeg?: number } = {}): SkillOutcome {
    const cfg = skillById.get(skill);
    const base: SkillOutcome = { ok: false, skill, cost, targets: [], kills: [], cooldownUntilMs: 0, rtpFactor: this.rtpFactor };
    if (!cfg) return { ...base, reason: 'SKILL_UNKNOWN' };
    if (this.cooldownUntil(uid, skill) > nowMs) return { ...base, reason: 'SKILL_COOLDOWN', cooldownUntilMs: this.cooldownUntil(uid, skill) };
    const cd = this.cooldowns.get(uid) ?? new Map<SkillId, number>();
    cd.set(skill, nowMs + cfg.cooldownMs);
    this.cooldowns.set(uid, cd);
    this.pool += cost;
    const out: SkillOutcome = { ...base, ok: true, cooldownUntilMs: nowMs + cfg.cooldownMs };

    if (skill === 'FREEZE') {
      const endMs = nowMs + (cfg.durationMs ?? 8000);
      this.freezes.push({ startMs: nowMs, endMs });
      if (this.freezes.length > 8) this.freezes.shift();
      for (const f of this.activeFish.values()) if (f.expireAtMs > nowMs) f.expireAtMs += cfg.durationMs ?? 8000;
      out.frozenUntilMs = endMs;
      return out;
    }
    if (skill === 'LOCK') {
      out.lockUntilMs = nowMs + (cfg.durationMs ?? 12000);
      return out;
    }

    const alive = this.onScreen(nowMs);
    let targets: { fish: ActiveFish; pos: [number, number] }[] = [];
    if (skill === 'MISSILE') {
      const want = opts.targetFishId != null ? alive.find((a) => a.fish.fishId === opts.targetFishId) : undefined;
      const best = want ?? [...alive].sort((a, b) => fishTypeById.get(b.fish.typeId)!.baseOdds - fishTypeById.get(a.fish.typeId)!.baseOdds)[0];
      if (best) targets = [best];
    } else if (skill === 'LASER') {
      // 从炮台 (0.5, 1) 沿 dirDeg 的射线走廊（半宽 0.07）
      const rad = ((opts.dirDeg ?? -90) * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      targets = alive
        .map((a) => {
          const px = a.pos[0] - 0.5;
          const py = a.pos[1] - 1;
          const along = px * dx + py * dy;
          const perp = Math.abs(px * dy - py * dx);
          return { a, along, perp };
        })
        .filter((t) => t.along > 0 && t.perp < 0.07)
        .sort((x, y) => x.along - y.along)
        .slice(0, cfg.maxTargets)
        .map((t) => t.a);
    } else if (skill === 'LIGHTNING') {
      const pool = alive.filter((a) => !this.bosses.has(a.fish.fishId));
      // 随机抽样（Fisher–Yates 前缀）
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = rng.int(i + 1);
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }
      targets = pool.slice(0, cfg.maxTargets);
    } else if (skill === 'NUKE') {
      targets = alive.slice(0, cfg.maxTargets);
    }
    out.targets = targets.map((t) => t.fish.fishId);
    if (!targets.length) return out;
    const virtualCost = cost / targets.length;
    for (const t of targets) {
      const boss = this.bosses.get(t.fish.fishId);
      if (boss) {
        out.boss = this.damageBoss(boss, uid, virtualCost, rng);
        continue;
      }
      const r = this.rollKill(t.fish.typeId, virtualCost, rng);
      if (r.dead) {
        this.pool -= r.reward;
        this.activeFish.delete(t.fish.fishId);
        out.kills.push({ fishId: t.fish.fishId, typeId: t.fish.typeId, reward: r.reward, roll: r.roll });
      }
    }
    return out;
  }
}
