/**
 * 捕鱼宿主：渔场房间（自由进出/最多4座）、波次广播、先扣费后发射、服务端命中判定、
 * Boss 血量与按伤害分奖、技能（道具优先 / 金币兜底，幂等）、审计落库。
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import { FishingRoomEngine, fishingStageById, fishTypeById, skillById, type BossOutcome, type SkillId } from '@yanbian/game-common/fishing';
import { secureRng } from '@yanbian/game-common';
import { getLogger, getRedis, loadEnv, nextId, query, randomToken } from '@yanbian/server-core';
import { getBalances, postTransaction, SYS } from '@yanbian/wallet';
import { hub, type GameSession } from '../hub.js';
import { bumpExp, bumpTask, bumpTournament } from '../settlement.js';

const log = getLogger('fishing');

interface FishPlayer {
  uid: number;
  seat: number;
  nickname: string;
  avatarId: number;
  sessionId: number;
  coinsIn: number;
  coinsOut: number;
  shots: number;
  kills: number;
  multiplier: number;
  overRateCount: number;
}

class FishRoom {
  roomId = nextId();
  engine: FishingRoomEngine;
  players = new Map<number, FishPlayer>();
  timer: NodeJS.Timeout | null = null;
  stageId: string;
  /** 技能请求结果缓存（requestId → 结果），配合钱包 / 道具幂等键防重复扣费与重复派奖 */
  skillResults = new Map<string, Record<string, unknown>>();

  constructor(stageId: string) {
    this.stageId = stageId;
    const stage = fishingStageById.get(stageId);
    if (!stage) throw new ApiError(ErrorCode.NOT_FOUND, '渔场不存在');
    this.engine = new FishingRoomEngine(stage);
  }

  broadcast(event: string, data: unknown, exceptUid?: number): void {
    for (const uid of this.players.keys()) {
      if (uid === exceptUid) continue;
      hub.send(uid, event, data);
    }
  }

  freeSeat(): number {
    const used = new Set([...this.players.values()].map((p) => p.seat));
    for (let s = 0; s < this.engine.stage.maxPlayers; s += 1) if (!used.has(s)) return s;
    return -1;
  }
}

const roomsByStage = new Map<string, FishRoom[]>();
const roomByUid = new Map<number, FishRoom>();

function fishView(f: { fishId: number; typeId: string; pathId: number; spawnAtMs: number; speedScale: number }): Record<string, unknown> {
  return { fishId: f.fishId, typeId: f.typeId, pathId: f.pathId, spawnAtMs: f.spawnAtMs, speedScale: f.speedScale };
}

function tickRoom(room: FishRoom): void {
  const now = Date.now();
  const wave = room.engine.nextWaveIfDue(now);
  if (wave) {
    if (wave.isBoss) {
      const boss = wave.fish.find((f) => fishTypeById.get(f.typeId)?.size === 'boss');
      room.broadcast(Ev.FsBossWarning, { atMs: boss?.spawnAtMs ?? now + 5000, typeId: boss?.typeId });
    }
    room.broadcast(Ev.FsWave, { waveId: wave.waveId, isBoss: wave.isBoss, serverNow: now, fish: wave.fish.map(fishView), bosses: wave.bosses });
  }
}

async function trackOnline(): Promise<void> {
  const total = [...roomsByStage.values()].flat().reduce((n, r) => n + r.players.size, 0);
  await getRedis().set('online:game:fishing', String(total)).catch(() => undefined);
}

async function creditKill(uid: number, room: FishRoom, key: string, amount: number, description: string): Promise<number> {
  const posted = await postTransaction({
    idempotencyKey: key,
    userId: uid,
    currency: 'COIN',
    type: 'GAME_WIN',
    amount,
    systemAccount: SYS.FISH_POOL,
    gameId: 'fishing',
    roomId: room.roomId,
    roundId: nextId(),
    description,
  });
  return posted.balanceAfter;
}

async function afterKill(uid: number, reward: number, kills = 1): Promise<void> {
  await bumpTask(uid, 'fish_kills', 'fishing', kills);
  await bumpTournament(uid, 'fishing', 'fish_kills', kills);
  await bumpTournament(uid, 'fishing', 'coin_win', reward);
  await bumpExp(uid, 5 * kills + Math.floor(reward / 200));
  const day = new Date().toISOString().slice(0, 10);
  await getRedis().zincrby(`rank:fish:${day}`, reward, String(uid)).catch(() => undefined);
  await getRedis().expire(`rank:fish:${day}`, 172800).catch(() => undefined);
}

/** Boss 血量变化 / 死亡：广播 HP，死亡时按伤害占比派奖（每人一条幂等交易 + 私发余额） */
async function applyBoss(room: FishRoom, boss: BossOutcome, byUid: number): Promise<number | undefined> {
  if (!boss.dead) {
    room.broadcast(Ev.FsBossHp, { fishId: boss.fishId, hp: boss.hp, maxHp: boss.maxHp, byUid });
    return undefined;
  }
  let myBalance: number | undefined;
  for (const r of boss.rewards) {
    const p = room.players.get(r.uid);
    const bal = await creditKill(r.uid, room, `fish:boss:${boss.fishId}:${r.uid}`, r.amount, 'Boss 击杀分奖');
    if (p) {
      p.coinsOut += r.amount;
      if (r.uid === byUid) p.kills += 1;
    }
    hub.send(r.uid, Ev.FsBossReward, { fishId: boss.fishId, amount: r.amount, balance: bal });
    if (r.uid === byUid) myBalance = bal;
    await afterKill(r.uid, r.amount, r.uid === byUid ? 1 : 0);
  }
  room.broadcast(Ev.FsBossDead, { fishId: boss.fishId, killerUid: byUid, rewards: boss.rewards });
  return myBalance;
}

export const fishingHost = {
  async enter(session: GameSession, stageId: string): Promise<void> {
    if (roomByUid.has(session.uid)) throw new ApiError(ErrorCode.ALREADY_IN_ROOM);
    const stage = fishingStageById.get(stageId);
    if (!stage) throw new ApiError(ErrorCode.NOT_FOUND, '渔场不存在');
    const balances = await getBalances(session.uid);
    if (balances.COIN < stage.minCoins) throw new ApiError(ErrorCode.MIN_BALANCE_REQUIRED);

    let list = roomsByStage.get(stageId);
    if (!list) {
      list = [];
      roomsByStage.set(stageId, list);
    }
    let room = list.find((r) => r.freeSeat() >= 0);
    if (!room) {
      room = new FishRoom(stageId);
      list.push(room);
      room.timer = setInterval(() => tickRoom(room!), 1000);
      tickRoom(room);
    }
    const seat = room.freeSeat();
    const profile = await query('SELECT nickname, avatar_id FROM user_profiles WHERE user_id=$1', [session.uid]);
    const sessionId = nextId();
    await query(`INSERT INTO fishing_sessions (session_id, user_id, room_id, stage_id) VALUES ($1,$2,$3,$4)`, [sessionId, session.uid, room.roomId, stageId]);
    const player: FishPlayer = {
      uid: session.uid,
      seat,
      nickname: (profile.rows[0]?.nickname as string) ?? `玩家${session.uid}`,
      avatarId: (profile.rows[0]?.avatar_id as number) ?? 1,
      sessionId,
      coinsIn: 0,
      coinsOut: 0,
      shots: 0,
      kills: 0,
      multiplier: stage.multipliers[0]!,
      overRateCount: 0,
    };
    room.players.set(session.uid, player);
    roomByUid.set(session.uid, room);
    session.roomId = room.roomId;
    session.gameCode = 'fishing';
    await trackOnline();

    hub.send(session.uid, Ev.FsState, { ...this.syncFor(session.uid)!, balance: balances.COIN });
    room.broadcast(Ev.FsPlayerJoined, { uid: session.uid, seat, nickname: player.nickname, avatarId: player.avatarId }, session.uid);
  },

  async fire(session: GameSession, data: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> {
    const room = roomByUid.get(session.uid);
    if (!room) throw new ApiError(ErrorCode.NOT_IN_ROOM);
    const player = room.players.get(session.uid)!;
    const multiplier = Number(data.multiplier);
    if (!room.engine.stage.multipliers.includes(multiplier)) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, '炮倍非法');
    const now = Date.now();
    if (!room.engine.checkFireRate(session.uid, now)) {
      player.overRateCount += 1;
      if (player.overRateCount === 50) {
        await query(`INSERT INTO risk_events (user_id, type, severity, evidence) VALUES ($1,'fire_rate','medium',$2)`, [
          session.uid,
          JSON.stringify({ stageId: room.stageId, count: player.overRateCount }),
        ]).catch(() => undefined);
      }
      throw new ApiError(ErrorCode.FIRE_TOO_FAST, undefined, 429);
    }
    const cost = room.engine.stage.bulletBaseCost * multiplier;
    // 先扣费（幂等键 = 客户端 requestId）
    const posted = await postTransaction({
      idempotencyKey: `fish:fire:${session.uid}:${requestId}`,
      userId: session.uid,
      currency: 'COIN',
      type: 'GAME_BET',
      amount: -cost,
      systemAccount: SYS.FISH_POOL,
      gameId: 'fishing',
      roomId: room.roomId,
      description: `捕鱼子弹 x${multiplier}`,
    });
    const bulletId = randomToken(8);
    room.engine.registerBullet(bulletId, session.uid, multiplier, now);
    player.shots += 1;
    player.coinsIn += cost;
    player.multiplier = multiplier;
    const dirDeg = Number(data.dirDeg ?? 0);
    await query(`INSERT INTO fishing_shots (bullet_id, user_id, room_id, multiplier, cost) VALUES ($1,$2,$3,$4,$5)`, [bulletId, session.uid, room.roomId, multiplier, cost]);
    room.broadcast(Ev.FsPlayerFire, { uid: session.uid, seat: player.seat, multiplier, dirDeg, bulletId }, session.uid);
    return { bulletId, balance: posted.balanceAfter, cost };
  },

  async hit(session: GameSession, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const room = roomByUid.get(session.uid);
    if (!room) throw new ApiError(ErrorCode.NOT_IN_ROOM);
    const player = room.players.get(session.uid)!;
    const bulletId = String(data.bulletId ?? '');
    const fishId = Number(data.fishId);
    if (!bulletId || !Number.isInteger(fishId)) throw new ApiError(ErrorCode.VALIDATION);
    const now = Date.now();
    const fishType = room.engine.activeFish.get(fishId)?.typeId ?? null;
    const outcome = room.engine.resolveHit(session.uid, bulletId, fishId, now, secureRng);
    if (!outcome.ok) {
      return { hit: false, dead: false, reason: outcome.reason, reward: 0 };
    }
    let balance: number | undefined;
    if (outcome.boss) {
      balance = await applyBoss(room, outcome.boss, session.uid);
    } else if (outcome.dead) {
      balance = await creditKill(session.uid, room, `fish:kill:${bulletId}`, outcome.reward, '击杀奖励');
      player.kills += 1;
      player.coinsOut += outcome.reward;
      room.broadcast(Ev.FsFishKilled, { fishId, byUid: session.uid, bySeat: player.seat, reward: outcome.reward });
      await afterKill(session.uid, outcome.reward);
    }
    await query(`UPDATE fishing_shots SET hit=true, dead=$2, reward=$3, fish_id=$4, fish_type=$6, rng_audit=$5 WHERE bullet_id=$1`, [
      bulletId,
      outcome.dead,
      outcome.reward,
      fishId,
      JSON.stringify({ odds: outcome.odds, rtpFactor: outcome.rtpFactor, roll: outcome.roll ?? null, boss: outcome.boss ? { hp: outcome.boss.hp, maxHp: outcome.boss.maxHp } : null }),
      fishType,
    ]);
    return {
      hit: true,
      dead: outcome.dead,
      reward: outcome.reward,
      balance,
      boss: outcome.boss ? { fishId: outcome.boss.fishId, hp: outcome.boss.hp, maxHp: outcome.boss.maxHp, dead: outcome.boss.dead } : undefined,
    };
  },

  /**
   * 技能：拥有道具 → 消耗道具；否则以金币支付（费用 = costBullets × 基础成本 × 当前炮倍）。
   * 目标选择 / 判定 / 奖励全部在引擎（服务端）完成；同一 requestId 重放直接返回首个结果。
   */
  async skill(session: GameSession, data: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> {
    const room = roomByUid.get(session.uid);
    if (!room) throw new ApiError(ErrorCode.NOT_IN_ROOM);
    const cached = room.skillResults.get(requestId);
    if (cached) return cached;
    const player = room.players.get(session.uid)!;
    const skill = String(data.skill ?? '') as SkillId;
    const cfg = skillById.get(skill);
    if (!cfg) throw new ApiError(ErrorCode.VALIDATION, '未知技能');
    const now = Date.now();
    const cdUntil = room.engine.cooldownUntil(session.uid, skill);
    if (cdUntil > now) throw new ApiError(ErrorCode.VALIDATION, `技能冷却中 ${Math.ceil((cdUntil - now) / 1000)}s`);
    const targetFishId = data.targetFishId == null ? undefined : Number(data.targetFishId);
    const dirDeg = data.dirDeg == null ? undefined : Number(data.dirDeg);
    const cost = cfg.costBullets * room.engine.stage.bulletBaseCost * player.multiplier;
    const key = `fish:skill:${session.uid}:${requestId}`;

    // 1) 支付：道具优先
    let costType: 'item' | 'coin' = 'coin';
    let itemQty: number | undefined;
    let balance: number | undefined;
    if (cfg.itemId) {
      const dup = await query('SELECT 1 FROM user_item_logs WHERE idempotency_key=$1', [key]);
      if (dup.rowCount) throw new ApiError(ErrorCode.DUPLICATE_TRANSACTION, '重复请求');
      const used = await query(`UPDATE user_items SET qty = qty - 1, updated_at = now() WHERE user_id=$1 AND item_id=$2 AND qty > 0 RETURNING qty`, [session.uid, cfg.itemId]);
      if (used.rowCount) {
        costType = 'item';
        itemQty = Number(used.rows[0]!.qty);
        await query(`INSERT INTO user_item_logs (user_id, item_id, delta, reason, ref_id, idempotency_key) VALUES ($1,$2,-1,'skill_use',$3,$4)`, [session.uid, cfg.itemId, String(room.roomId), key]);
      }
    }
    if (costType === 'coin') {
      const posted = await postTransaction({
        idempotencyKey: key,
        userId: session.uid,
        currency: 'COIN',
        type: 'GAME_BET',
        amount: -cost,
        systemAccount: SYS.FISH_POOL,
        gameId: 'fishing',
        roomId: room.roomId,
        description: `捕鱼技能 ${skill}`,
      });
      if (posted.duplicated) throw new ApiError(ErrorCode.DUPLICATE_TRANSACTION, '重复请求');
      balance = posted.balanceAfter;
      player.coinsIn += cost;
    }

    // 2) 判定
    const out = room.engine.useSkill(session.uid, skill, cost, now, secureRng, { targetFishId, dirDeg });
    if (!out.ok) {
      // 竞态导致的冷却拒绝：退款（幂等）
      if (costType === 'coin') {
        const refund = await postTransaction({ idempotencyKey: `${key}:refund`, userId: session.uid, currency: 'COIN', type: 'GAME_REFUND', amount: cost, systemAccount: SYS.FISH_POOL, gameId: 'fishing', roomId: room.roomId, description: '技能退款' });
        balance = refund.balanceAfter;
      } else if (cfg.itemId) {
        await query(`UPDATE user_items SET qty = qty + 1 WHERE user_id=$1 AND item_id=$2`, [session.uid, cfg.itemId]);
      }
      throw new ApiError(ErrorCode.VALIDATION, out.reason === 'SKILL_COOLDOWN' ? '技能冷却中' : '技能不可用');
    }

    // 3) 派奖
    const total = out.kills.reduce((s, k) => s + k.reward, 0);
    if (total > 0) {
      balance = await creditKill(session.uid, room, `fish:skillwin:${session.uid}:${requestId}`, total, `技能击杀 ${skill}`);
      player.kills += out.kills.length;
      player.coinsOut += total;
      for (const k of out.kills) room.broadcast(Ev.FsFishKilled, { fishId: k.fishId, byUid: session.uid, bySeat: player.seat, reward: k.reward, skill });
      await afterKill(session.uid, total, out.kills.length);
    }
    if (out.boss) {
      const b = await applyBoss(room, out.boss, session.uid);
      if (b !== undefined) balance = b;
    }
    if (out.frozenUntilMs) room.broadcast(Ev.FsFrozen, { startMs: now, untilMs: out.frozenUntilMs, byUid: session.uid });
    room.broadcast(Ev.FsSkillUsed, { uid: session.uid, seat: player.seat, skill, targets: out.targets, dirDeg, targetFishId }, session.uid);
    await query(
      `INSERT INTO fishing_skill_uses (user_id, room_id, skill, cost_type, cost, kills, reward, rng_audit, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (idempotency_key) DO NOTHING`,
      [session.uid, room.roomId, skill, costType, cost, out.kills.length, total, JSON.stringify({ rtpFactor: out.rtpFactor, rolls: out.kills.map((k) => k.roll), targets: out.targets }), `fish:skilluse:${session.uid}:${requestId}`],
    ).catch(() => undefined);
    if (balance === undefined) balance = (await getBalances(session.uid)).COIN;
    const result: Record<string, unknown> = {
      skill,
      cost,
      costType,
      itemQty,
      targets: out.targets,
      kills: out.kills.map((k) => ({ fishId: k.fishId, typeId: k.typeId, reward: k.reward })),
      boss: out.boss ? { fishId: out.boss.fishId, hp: out.boss.hp, maxHp: out.boss.maxHp, dead: out.boss.dead } : undefined,
      frozenUntilMs: out.frozenUntilMs,
      lockUntilMs: out.lockUntilMs,
      cooldownUntilMs: out.cooldownUntilMs,
      balance,
    };
    room.skillResults.set(requestId, result);
    if (room.skillResults.size > 100) room.skillResults.delete(room.skillResults.keys().next().value as string);
    return result;
  },

  async leave(session: GameSession): Promise<void> {
    const room = roomByUid.get(session.uid);
    if (!room) return;
    const player = room.players.get(session.uid);
    if (player) {
      await query(`UPDATE fishing_sessions SET coins_in=$2, coins_out=$3, shots=$4, kills=$5, left_at=now() WHERE session_id=$1`, [
        player.sessionId,
        player.coinsIn,
        player.coinsOut,
        player.shots,
        player.kills,
      ]).catch(() => undefined);
    }
    room.players.delete(session.uid);
    roomByUid.delete(session.uid);
    session.roomId = null;
    session.gameCode = null;
    room.broadcast(Ev.FsPlayerLeft, { uid: session.uid });
    if (room.players.size === 0 && room.timer) {
      clearInterval(room.timer);
      room.timer = null;
      const list = roomsByStage.get(room.stageId);
      if (list) roomsByStage.set(room.stageId, list.filter((r) => r !== room));
    }
    await trackOnline();
    log.info({ uid: session.uid, roomId: room.roomId }, 'fishing leave');
  },

  isIn(uid: number): boolean {
    return roomByUid.has(uid);
  },

  syncFor(uid: number): Record<string, unknown> | null {
    const room = roomByUid.get(uid);
    if (!room) return null;
    const stage = room.engine.stage;
    const now = Date.now();
    const player = room.players.get(uid)!;
    return {
      gameCode: 'fishing',
      roomId: String(room.roomId),
      stage: { stageId: room.stageId, name: stage.name, multipliers: stage.multipliers, bulletBaseCost: stage.bulletBaseCost, maxFireRate: stage.maxFireRate },
      mySeat: player.seat,
      serverNow: now,
      players: [...room.players.values()].map((p) => ({ uid: p.uid, seat: p.seat, nickname: p.nickname, avatarId: p.avatarId, multiplier: p.multiplier })),
      fish: [...room.engine.activeFish.values()].filter((f) => f.expireAtMs > now).map(fishView),
      bosses: [...room.engine.bosses.values()].map((b) => ({ fishId: b.fishId, hp: b.hp, maxHp: b.maxHp })),
      freezes: room.engine.freezes.filter((w) => w.endMs > now - 60000),
      cooldowns: Object.fromEntries([...skillById.keys()].map((s) => [s, room.engine.cooldownUntil(uid, s)])),
    };
  },
};

export function fishingServerId(): string {
  return loadEnv().serverId;
}
