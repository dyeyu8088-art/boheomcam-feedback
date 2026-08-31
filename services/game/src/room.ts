/**
 * 房间系统：创建/加入/准备/离开/解散、座位、断线标记、重连快照、持久化。
 * 对局逻辑由 GameHost（mahjong/hongshi）驱动；捕鱼水果机使用独立房间模型。
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import { getLogger, getRedis, hashPassword, nextId, nextRoomNo, query, verifyPassword, loadEnv } from '@yanbian/server-core';
import { getBalances } from '@yanbian/wallet';
import { hub, type GameSession } from './hub.js';

const log = getLogger('room');

export interface StageConf {
  stageId: string;
  name: string;
  minCoins: number;
  baseScore: number;
  totalRounds: number;
}

export interface RoomPlayer {
  uid: number;
  seat: number;
  nickname: string;
  avatarId: number;
  vip: number;
  ready: boolean;
  online: boolean;
  trustee: boolean;
  score: number;
  isBot: boolean;
  coins: number;
}

export interface GameHost {
  /** 全员就绪时开局 */
  start(room: Room): void;
  /** 玩家动作 */
  onAction(room: Room, uid: number, event: string, data: Record<string, unknown>): void;
  /** 重连快照 */
  syncFor(room: Room, uid: number): Record<string, unknown> | null;
  /** 玩家离线（进入托管） */
  onOffline(room: Room, uid: number): void;
  onReconnect(room: Room, uid: number): void;
  /** 房间销毁（清理计时器） */
  dispose(room: Room): void;
}

export class Room {
  roomId: number;
  roomNo: string;
  gameCode: string;
  stage: StageConf;
  mode: 'match' | 'private';
  ownerUid: number | null;
  passwordHash: string | null = null;
  players: RoomPlayer[] = [];
  maxPlayers: number;
  state: 'waiting' | 'playing' | 'settling' | 'finished' = 'waiting';
  currentRound = 0;
  totalRounds: number;
  ruleVersion: string;
  host: GameHost;
  /** 宿主私有状态（table 等） */
  hostState: Record<string, unknown> = {};

  constructor(opts: {
    gameCode: string;
    stage: StageConf;
    mode: 'match' | 'private';
    ownerUid: number | null;
    maxPlayers: number;
    totalRounds: number;
    ruleVersion: string;
    host: GameHost;
  }) {
    this.roomId = nextId();
    this.roomNo = nextRoomNo();
    this.gameCode = opts.gameCode;
    this.stage = opts.stage;
    this.mode = opts.mode;
    this.ownerUid = opts.ownerUid;
    this.maxPlayers = opts.maxPlayers;
    this.totalRounds = opts.totalRounds;
    this.ruleVersion = opts.ruleVersion;
    this.host = opts.host;
  }

  playerBySeat(seat: number): RoomPlayer | undefined {
    return this.players.find((p) => p.seat === seat);
  }

  playerByUid(uid: number): RoomPlayer | undefined {
    return this.players.find((p) => p.uid === uid);
  }

  broadcast(event: string, data: unknown): void {
    for (const p of this.players) {
      if (!p.isBot) hub.send(p.uid, event, data);
    }
  }

  sendSeat(seat: number, event: string, data: unknown): void {
    const p = this.playerBySeat(seat);
    if (p && !p.isBot) hub.send(p.uid, event, data);
  }

  info(): Record<string, unknown> {
    return {
      roomId: String(this.roomId),
      roomNo: this.roomNo,
      gameCode: this.gameCode,
      stageId: this.stage.stageId,
      baseScore: this.stage.baseScore,
      mode: this.mode,
      ownerUid: this.ownerUid,
      maxPlayers: this.maxPlayers,
      totalRounds: this.totalRounds,
      currentRound: this.currentRound,
      state: this.state,
      ruleVersion: this.ruleVersion,
      hasPassword: !!this.passwordHash,
      players: this.players.map((p) => ({
        uid: p.uid,
        seat: p.seat,
        nickname: p.nickname,
        avatarId: p.avatarId,
        vip: p.vip,
        ready: p.ready,
        online: p.online,
        trustee: p.trustee,
        score: p.score,
      })),
    };
  }
}

export class RoomManager {
  rooms = new Map<number, Room>();
  byRoomNo = new Map<string, Room>();
  byUid = new Map<number, Room>();

  async persistCreate(room: Room, ruleSnapshot: unknown): Promise<void> {
    await query(
      `INSERT INTO rooms (room_id, game_id, stage_id, room_no, mode, owner_id, password_hash, rule_snapshot, total_rounds, state, server_node)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'waiting',$10)`,
      [
        room.roomId,
        room.gameCode,
        room.stage.stageId,
        room.roomNo,
        room.mode,
        room.ownerUid,
        room.passwordHash,
        JSON.stringify(ruleSnapshot ?? {}),
        room.totalRounds,
        loadEnv().serverId,
      ],
    );
  }

  register(room: Room): void {
    this.rooms.set(room.roomId, room);
    this.byRoomNo.set(room.roomNo, room);
  }

  async addPlayer(room: Room, session: GameSession): Promise<RoomPlayer> {
    if (this.byUid.has(session.uid)) throw new ApiError(ErrorCode.ALREADY_IN_ROOM);
    if (room.players.filter((p) => !p.isBot).length >= room.maxPlayers) throw new ApiError(ErrorCode.ROOM_FULL);
    if (room.state !== 'waiting') throw new ApiError(ErrorCode.ROOM_STARTED);
    const balances = await getBalances(session.uid);
    if (balances.COIN < room.stage.minCoins) throw new ApiError(ErrorCode.MIN_BALANCE_REQUIRED);
    const profile = await query('SELECT nickname, avatar_id, vip FROM user_profiles WHERE user_id=$1', [session.uid]);
    // 替换一个机器人座位或占用空座
    const botSeatIdx = room.players.findIndex((p) => p.isBot);
    let seat: number;
    if (botSeatIdx >= 0 && room.players.length >= room.maxPlayers) {
      seat = room.players[botSeatIdx]!.seat;
      room.players.splice(botSeatIdx, 1);
    } else {
      const used = new Set(room.players.map((p) => p.seat));
      seat = 0;
      while (used.has(seat)) seat += 1;
    }
    const player: RoomPlayer = {
      uid: session.uid,
      seat,
      nickname: (profile.rows[0]?.nickname as string) ?? `玩家${session.uid}`,
      avatarId: (profile.rows[0]?.avatar_id as number) ?? 1,
      vip: (profile.rows[0]?.vip as number) ?? 0,
      ready: room.mode === 'match',
      online: true,
      trustee: false,
      score: 0,
      isBot: false,
      coins: balances.COIN,
    };
    room.players.push(player);
    room.players.sort((a, b) => a.seat - b.seat);
    this.byUid.set(session.uid, room);
    session.roomId = room.roomId;
    session.gameCode = room.gameCode;
    await query(
      `INSERT INTO room_players (room_id, user_id, seat, state) VALUES ($1,$2,$3,'joined')
       ON CONFLICT (room_id, seat) DO UPDATE SET user_id=EXCLUDED.user_id, state='joined', left_at=NULL`,
      [room.roomId, session.uid, seat],
    );
    await getRedis().set(`playing:${session.uid}`, room.gameCode, 'EX', 7200).catch(() => undefined);
    room.broadcast(Ev.RoomPlayerJoined, { player: room.info().players && room.players.find((p) => p.uid === session.uid) });
    return player;
  }

  async removePlayer(room: Room, uid: number, reason: string): Promise<void> {
    const idx = room.players.findIndex((p) => p.uid === uid);
    if (idx < 0) return;
    if (room.state === 'playing') throw new ApiError(ErrorCode.INVALID_ACTION, '对局中不能退出（可托管）');
    room.players.splice(idx, 1);
    this.byUid.delete(uid);
    const session = hub.get(uid);
    if (session) {
      session.roomId = null;
      session.gameCode = null;
    }
    await query(`UPDATE room_players SET left_at=now(), state='left' WHERE room_id=$1 AND user_id=$2`, [room.roomId, uid]);
    await getRedis().del(`playing:${uid}`).catch(() => undefined);
    room.broadcast(Ev.RoomPlayerLeft, { uid, reason });
    if (room.players.filter((p) => !p.isBot).length === 0) {
      await this.destroyRoom(room, 'empty');
    }
  }

  async destroyRoom(room: Room, reason: string): Promise<void> {
    room.host.dispose(room);
    for (const p of room.players) {
      this.byUid.delete(p.uid);
      const s = hub.get(p.uid);
      if (s) {
        s.roomId = null;
        s.gameCode = null;
      }
      await getRedis().del(`playing:${p.uid}`).catch(() => undefined);
    }
    this.rooms.delete(room.roomId);
    this.byRoomNo.delete(room.roomNo);
    room.state = 'finished';
    await query(`UPDATE rooms SET state=$2, closed_at=now() WHERE room_id=$1`, [room.roomId, reason === 'dissolved' ? 'dissolved' : 'finished']);
    log.info({ roomId: room.roomId, reason }, 'room destroyed');
  }

  roomOf(uid: number): Room | undefined {
    return this.byUid.get(uid);
  }

  async setPassword(room: Room, password: string | null): Promise<void> {
    room.passwordHash = password ? hashPassword(password) : null;
    await query(`UPDATE rooms SET password_hash=$2 WHERE room_id=$1`, [room.roomId, room.passwordHash]);
  }

  checkPassword(room: Room, password: string | undefined): void {
    if (!room.passwordHash) return;
    if (!password || !verifyPassword(password, room.passwordHash)) throw new ApiError(ErrorCode.ROOM_PASSWORD);
  }
}

export const roomManager = new RoomManager();
