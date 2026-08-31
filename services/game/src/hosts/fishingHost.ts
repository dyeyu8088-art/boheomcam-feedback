/**
 * 捕鱼宿主：渔场房间（自由进出/最多4座）、波次广播、先扣费后发射、服务端命中判定、审计落库。
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import { FishingRoomEngine, fishingStageById, FISH_TYPES } from '@yanbian/game-common/fishing';
import { secureRng } from '@yanbian/game-common';
import { getLogger, getRedis, loadEnv, nextId, query, randomToken } from '@yanbian/server-core';
import { getBalances, postTransaction, SYS } from '@yanbian/wallet';
import { hub, type GameSession } from '../hub.js';
import { bumpTask } from '../settlement.js';

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

function tickRoom(room: FishRoom): void {
  const now = Date.now();
  const wave = room.engine.nextWaveIfDue(now);
  if (wave) {
    if (wave.isBoss) {
      const boss = wave.fish.find((f) => {
        const t = FISH_TYPES.find((x) => x.typeId === f.typeId);
        return t?.size === 'boss';
      });
      room.broadcast(Ev.FsBossWarning, { atMs: boss?.spawnAtMs ?? now + 5000, typeId: boss?.typeId });
    }
    room.broadcast(Ev.FsWave, {
      waveId: wave.waveId,
      isBoss: wave.isBoss,
      serverNow: now,
      fish: wave.fish.map((f) => ({
        fishId: f.fishId,
        typeId: f.typeId,
        pathId: f.pathId,
        spawnAtMs: f.spawnAtMs,
        speedScale: f.speedScale,
      })),
    });
  }
}

async function trackOnline(): Promise<void> {
  const total = [...roomsByStage.values()].flat().reduce((n, r) => n + r.players.size, 0);
  await getRedis().set('online:game:fishing', String(total)).catch(() => undefined);
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
    await query(
      `INSERT INTO fishing_sessions (session_id, user_id, room_id, stage_id) VALUES ($1,$2,$3,$4)`,
      [sessionId, session.uid, room.roomId, stageId],
    );
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

    const now = Date.now();
    hub.send(session.uid, Ev.FsState, {
      roomId: String(room.roomId),
      stage: {
        stageId,
        name: stage.name,
        multipliers: stage.multipliers,
        bulletBaseCost: stage.bulletBaseCost,
        maxFireRate: stage.maxFireRate,
      },
      mySeat: seat,
      balance: balances.COIN,
      serverNow: now,
      players: [...room.players.values()].map((p) => ({ uid: p.uid, seat: p.seat, nickname: p.nickname, avatarId: p.avatarId, multiplier: p.multiplier })),
      fish: [...room.engine.activeFish.values()]
        .filter((f) => f.expireAtMs > now)
        .map((f) => ({ fishId: f.fishId, typeId: f.typeId, pathId: f.pathId, spawnAtMs: f.spawnAtMs, speedScale: f.speedScale })),
    });
    room.broadcast('fishing.playerJoined', { uid: session.uid, seat, nickname: player.nickname, avatarId: player.avatarId }, session.uid);
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
        await query(
          `INSERT INTO risk_events (user_id, type, severity, evidence) VALUES ($1,'fire_rate','medium',$2)`,
          [session.uid, JSON.stringify({ stageId: room.stageId, count: player.overRateCount })],
        ).catch(() => undefined);
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
    await query(
      `INSERT INTO fishing_shots (bullet_id, user_id, room_id, multiplier, cost) VALUES ($1,$2,$3,$4,$5)`,
      [bulletId, session.uid, room.roomId, multiplier, cost],
    );
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
    const outcome = room.engine.resolveHit(session.uid, bulletId, fishId, now, secureRng);
    if (!outcome.ok) {
      return { hit: false, dead: false, reason: outcome.reason, reward: 0 };
    }
    let balance: number | undefined;
    if (outcome.dead) {
      const roundId = nextId();
      const posted = await postTransaction({
        idempotencyKey: `fish:kill:${bulletId}`,
        userId: session.uid,
        currency: 'COIN',
        type: 'GAME_WIN',
        amount: outcome.reward,
        systemAccount: SYS.FISH_POOL,
        gameId: 'fishing',
        roomId: room.roomId,
        roundId,
        description: `击杀奖励`,
      });
      balance = posted.balanceAfter;
      player.kills += 1;
      player.coinsOut += outcome.reward;
      const fishType = (room.engine.activeFish.get(fishId), data.fishId);
      void fishType;
      room.broadcast(Ev.FsFishKilled, { fishId, byUid: session.uid, bySeat: player.seat, reward: outcome.reward });
      await bumpTask(session.uid, 'fish_kills', 'fishing');
      const day = new Date().toISOString().slice(0, 10);
      await getRedis().zincrby(`rank:fish:${day}`, outcome.reward, String(session.uid)).catch(() => undefined);
      await getRedis().expire(`rank:fish:${day}`, 172800).catch(() => undefined);
    }
    await query(
      `UPDATE fishing_shots SET hit=true, dead=$2, reward=$3, fish_id=$4, rng_audit=$5 WHERE bullet_id=$1`,
      [bulletId, outcome.dead, outcome.reward, fishId, JSON.stringify({ odds: outcome.odds, rtpFactor: outcome.rtpFactor, roll: outcome.roll ?? null })],
    );
    return { hit: true, dead: outcome.dead, reward: outcome.reward, balance };
  },

  async leave(session: GameSession): Promise<void> {
    const room = roomByUid.get(session.uid);
    if (!room) return;
    const player = room.players.get(session.uid);
    if (player) {
      await query(
        `UPDATE fishing_sessions SET coins_in=$2, coins_out=$3, shots=$4, kills=$5, left_at=now() WHERE session_id=$1`,
        [player.sessionId, player.coinsIn, player.coinsOut, player.shots, player.kills],
      ).catch(() => undefined);
    }
    room.players.delete(session.uid);
    roomByUid.delete(session.uid);
    session.roomId = null;
    session.gameCode = null;
    room.broadcast('fishing.playerLeft', { uid: session.uid });
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
      fish: [...room.engine.activeFish.values()]
        .filter((f) => f.expireAtMs > now)
        .map((f) => ({ fishId: f.fishId, typeId: f.typeId, pathId: f.pathId, spawnAtMs: f.spawnAtMs, speedScale: f.speedScale })),
    };
  },
};

export function fishingServerId(): string {
  return loadEnv().serverId;
}
