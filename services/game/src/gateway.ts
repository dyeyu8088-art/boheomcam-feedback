/**
 * game-gateway：WS 接入。握手鉴权 → 会话 → 信封校验(seq/时间戳/requestId 幂等) → 路由。
 * 请求-响应事件回 `${event}.ok`（带 ack）或 `sys.error`；推送事件带 pushSeq。
 */
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { ApiError, ErrorCode, ErrorMessage, Ev, type WsDown, type WsUp } from '@yanbian/protocol';
import { counterInc, getLogger, getRedis, loadEnv, verifyJwt } from '@yanbian/server-core';
import { hub, type GameSession } from './hub.js';
import { roomManager, Room } from './room.js';
import { cancelMatch, startMatch } from './matchmaker.js';
import { mahjongHost } from './hosts/mahjongHost.js';
import { hongshiHost } from './hosts/hongshiHost.js';
import { fishingHost } from './hosts/fishingHost.js';
import { slotHost } from './hosts/slotHost.js';
import { loadMahjongRule, loadHongshiRule, gameOnline } from './configs.js';

const log = getLogger('gateway');

function sendError(session: GameSession, ack: number | undefined, event: string, code: number, msg?: string): void {
  hub.sendTo(session, Ev.SysError, { event, code, msg: msg ?? ErrorMessage[code] ?? 'error' }, { ack, code });
}

async function syncSnapshot(session: GameSession): Promise<Record<string, unknown> | null> {
  const room = roomManager.roomOf(session.uid);
  if (room) return { kind: 'room', ...room.host.syncFor(room, session.uid) };
  if (fishingHost.isIn(session.uid)) return { kind: 'fishing', ...fishingHost.syncFor(session.uid) };
  return null;
}

async function handleMessage(session: GameSession, raw: string): Promise<void> {
  let msg: WsUp;
  try {
    msg = JSON.parse(raw) as WsUp;
  } catch {
    sendError(session, undefined, 'parse', ErrorCode.BAD_REQUEST, '非法消息');
    return;
  }
  if (msg.v !== 1 || typeof msg.event !== 'string' || typeof msg.seq !== 'number') {
    sendError(session, msg.seq, msg.event ?? 'unknown', ErrorCode.BAD_REQUEST, '信封格式错误');
    return;
  }
  // seq 单调递增：过滤重复/乱序（心跳除外）
  if (msg.event !== Ev.SysPing) {
    if (msg.seq <= session.lastSeq) {
      counterInc('ws_seq_rejected_total');
      return;
    }
    session.lastSeq = msg.seq;
  }
  session.lastSeenAt = Date.now();

  // requestId 幂等：命中缓存直接重发原响应
  if (msg.requestId) {
    const cached = session.recentRequests.get(msg.requestId);
    if (cached) {
      hub.sendTo(session, cached.event, cached.data, { ack: msg.seq, code: cached.code });
      return;
    }
  }

  const reply = (event: string, data: unknown): void => {
    const frame: WsDown = { v: 1, event, ack: msg.seq, timestamp: Date.now(), code: 0, data };
    if (msg.requestId) {
      session.recentRequests.set(msg.requestId, frame);
      if (session.recentRequests.size > 200) {
        const first = session.recentRequests.keys().next().value as string;
        session.recentRequests.delete(first);
      }
    }
    hub.sendTo(session, event, data, { ack: msg.seq });
  };

  try {
    switch (msg.event) {
      case Ev.SysPing:
        hub.sendTo(session, Ev.SysPong, { t: (msg.data as { t?: number })?.t ?? 0, serverTime: Date.now() }, { ack: msg.seq });
        return;
      case Ev.SysResync: {
        reply('sys.resync.ok', { snapshot: await syncSnapshot(session) });
        return;
      }

      case Ev.MatchStart: {
        const d = msg.data as { gameCode?: string; stageId?: string };
        if (!d.gameCode || !d.stageId) throw new ApiError(ErrorCode.VALIDATION);
        if (!(await gameOnline(d.gameCode))) throw new ApiError(ErrorCode.MAINTENANCE, '游戏维护中');
        await startMatch(session, d.gameCode, d.stageId);
        reply('match.start.ok', {});
        return;
      }
      case Ev.MatchCancel:
        cancelMatch(session.uid);
        reply('match.cancel.ok', {});
        return;

      case Ev.RoomCreate: {
        const d = msg.data as { gameCode?: string; baseScore?: number; totalRounds?: number; password?: string };
        if (!d.gameCode || !['mahjong_yanbian', 'hongshi'].includes(d.gameCode)) throw new ApiError(ErrorCode.VALIDATION);
        if (!(await gameOnline(d.gameCode))) throw new ApiError(ErrorCode.MAINTENANCE, '游戏维护中');
        if (roomManager.roomOf(session.uid)) throw new ApiError(ErrorCode.ALREADY_IN_ROOM);
        const rule = d.gameCode === 'mahjong_yanbian' ? await loadMahjongRule() : await loadHongshiRule();
        const allowedBase = [10, 50, 100, 500];
        const baseScore = allowedBase.includes(Number(d.baseScore)) ? Number(d.baseScore) : 10;
        const roundOptions = rule.match.roundOptions;
        const totalRounds = roundOptions.includes(Number(d.totalRounds)) ? Number(d.totalRounds) : roundOptions[0]!;
        const stage = {
          stageId: 'private',
          name: '好友房',
          minCoins: baseScore * 20,
          baseScore,
          totalRounds,
        };
        const room = new Room({
          gameCode: d.gameCode,
          stage,
          mode: 'private',
          ownerUid: session.uid,
          maxPlayers: 4,
          totalRounds,
          ruleVersion: rule.ruleVersion,
          host: d.gameCode === 'mahjong_yanbian' ? mahjongHost : hongshiHost,
        });
        roomManager.register(room);
        if (d.password) await roomManager.setPassword(room, String(d.password).slice(0, 16));
        await roomManager.persistCreate(room, { ruleVersion: rule.ruleVersion, stage });
        await roomManager.addPlayer(room, session);
        reply('room.create.ok', { room: room.info() });
        return;
      }

      case Ev.RoomJoin: {
        const d = msg.data as { roomNo?: string; password?: string };
        const room = roomManager.byRoomNo.get(String(d.roomNo ?? ''));
        if (!room) throw new ApiError(ErrorCode.ROOM_NOT_FOUND);
        roomManager.checkPassword(room, d.password);
        await roomManager.addPlayer(room, session);
        reply('room.join.ok', { room: room.info() });
        return;
      }

      case Ev.RoomReady:
      case Ev.RoomUnready: {
        const room = roomManager.roomOf(session.uid);
        if (!room) throw new ApiError(ErrorCode.NOT_IN_ROOM);
        const p = room.playerByUid(session.uid)!;
        p.ready = msg.event === Ev.RoomReady;
        room.broadcast(Ev.RoomPlayerReady, { seat: p.seat, ready: p.ready });
        reply(`${msg.event}.ok`, {});
        const humans = room.players.filter((x) => !x.isBot);
        if (room.state === 'waiting' && humans.length === room.maxPlayers && humans.every((x) => x.ready)) {
          room.host.start(room);
        }
        return;
      }

      case Ev.RoomLeave: {
        const room = roomManager.roomOf(session.uid);
        if (room) await roomManager.removePlayer(room, session.uid, 'leave');
        if (fishingHost.isIn(session.uid)) await fishingHost.leave(session);
        slotHost.leave(session);
        reply('room.leave.ok', {});
        return;
      }

      case Ev.RoomDissolve: {
        const room = roomManager.roomOf(session.uid);
        if (!room) throw new ApiError(ErrorCode.NOT_IN_ROOM);
        if (room.ownerUid !== session.uid) throw new ApiError(ErrorCode.INVALID_ACTION, '仅房主可解散');
        if (room.state !== 'waiting') throw new ApiError(ErrorCode.INVALID_ACTION, '对局中不可解散');
        room.broadcast(Ev.RoomDissolve, { by: session.uid });
        await roomManager.destroyRoom(room, 'dissolved');
        reply('room.dissolve.ok', {});
        return;
      }

      case Ev.RoomChat: {
        const room = roomManager.roomOf(session.uid);
        if (!room) throw new ApiError(ErrorCode.NOT_IN_ROOM);
        const d = msg.data as { quickId?: number; emojiId?: number; text?: string };
        const p = room.playerByUid(session.uid)!;
        // 快捷语/表情按 ID 白名单；自由文本限长且服务端转义由客户端渲染层处理
        const payload: Record<string, unknown> = { seat: p.seat, uid: session.uid };
        if (d.quickId !== undefined && Number.isInteger(d.quickId) && d.quickId >= 0 && d.quickId < 12) payload.quickId = d.quickId;
        else if (d.emojiId !== undefined && Number.isInteger(d.emojiId) && d.emojiId >= 0 && d.emojiId < 24) payload.emojiId = d.emojiId;
        else if (typeof d.text === 'string' && d.text.trim().length > 0) payload.text = d.text.trim().slice(0, 60);
        else throw new ApiError(ErrorCode.VALIDATION);
        room.broadcast(Ev.RoomChat, payload);
        return;
      }

      // ── 捕鱼 ───────────────────────────────
      case Ev.FsEnter: {
        const d = msg.data as { stageId?: string };
        if (!(await gameOnline('fishing'))) throw new ApiError(ErrorCode.MAINTENANCE, '游戏维护中');
        await fishingHost.enter(session, String(d.stageId ?? 'fishing_novice'));
        reply('fishing.enter.ok', {});
        return;
      }
      case Ev.FsFire: {
        if (!msg.requestId) throw new ApiError(ErrorCode.VALIDATION, '缺少 requestId');
        const r = await fishingHost.fire(session, msg.data as Record<string, unknown>, msg.requestId);
        reply(Ev.FsFireOk, r);
        return;
      }
      case Ev.FsHit: {
        const r = await fishingHost.hit(session, msg.data as Record<string, unknown>);
        reply(Ev.FsHitResult, r);
        return;
      }
      case Ev.FsSkill: {
        if (!msg.requestId) throw new ApiError(ErrorCode.VALIDATION, '缺少 requestId');
        const r = await fishingHost.skill(session, msg.data as Record<string, unknown>, msg.requestId);
        reply('fishing.skill.ok', r);
        return;
      }
      case Ev.FsLeave: {
        await fishingHost.leave(session);
        reply('fishing.leave.ok', {});
        return;
      }

      // ── 水果机 ─────────────────────────────
      case Ev.SlEnter: {
        if (!(await gameOnline('slot_fruit'))) throw new ApiError(ErrorCode.MAINTENANCE, '游戏维护中');
        reply('slot.enter.ok', await slotHost.enter(session));
        return;
      }
      case Ev.SlSpin: {
        if (!msg.requestId) throw new ApiError(ErrorCode.VALIDATION, '缺少 requestId');
        const r = await slotHost.spin(session, msg.data as Record<string, unknown>, msg.requestId);
        reply(Ev.SlSpinResult, r);
        return;
      }
      case Ev.SlHistory: {
        reply('slot.history.ok', await slotHost.history(session));
        return;
      }
      case Ev.SlTicket: {
        if (!msg.requestId) throw new ApiError(ErrorCode.VALIDATION, '缺少 requestId');
        reply('slot.ticket.ok', await slotHost.useTicket(session, msg.data as Record<string, unknown>, msg.requestId));
        return;
      }

      default: {
        // 桌面游戏动作（mahjong.* / hongshi.* / game.trustee）
        if (msg.event.startsWith('mahjong.') || msg.event.startsWith('hongshi.') || msg.event === 'game.trustee') {
          const room = roomManager.roomOf(session.uid);
          if (!room) throw new ApiError(ErrorCode.NOT_IN_ROOM);
          room.host.onAction(room, session.uid, msg.event, (msg.data ?? {}) as Record<string, unknown>);
          reply(`${msg.event}.ok`, {});
          return;
        }
        throw new ApiError(ErrorCode.BAD_REQUEST, `未知事件 ${msg.event}`);
      }
    }
  } catch (e) {
    if (e instanceof ApiError) {
      sendError(session, msg.seq, msg.event, e.code, e.message);
      return;
    }
    const err = e as Error;
    // 引擎抛出的规则错误（INVALID_ACTION/NOT_YOUR_TURN 前缀）
    if (err.message.startsWith('NOT_YOUR_TURN')) {
      sendError(session, msg.seq, msg.event, ErrorCode.NOT_YOUR_TURN);
      return;
    }
    if (err.message.startsWith('INVALID_ACTION')) {
      sendError(session, msg.seq, msg.event, ErrorCode.INVALID_ACTION, err.message.replace('INVALID_ACTION:', ''));
      return;
    }
    log.error({ uid: session.uid, event: msg.event, err: err.message, stack: err.stack }, 'ws handler error');
    counterInc('ws_errors_total');
    sendError(session, msg.seq, msg.event, ErrorCode.INTERNAL);
  }
}

export function startGateway(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port, path: '/ws' });

  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    void (async () => {
      const url = new URL(req.url ?? '/ws', 'http://localhost');
      const token = url.searchParams.get('token') ?? '';
      const payload = verifyJwt(token, loadEnv().jwtSecret);
      if (!payload || payload.typ !== 'user') {
        socket.close(4401, 'unauthorized');
        return;
      }
      const uid = payload.sub;
      const deviceId = (payload.dev as string) ?? '';
      const session = hub.attach(uid, deviceId, socket);
      counterInc('ws_connects_total');
      await getRedis().set(`online:${uid}`, '1', 'EX', 120).catch(() => undefined);

      // 重连恢复
      const room = roomManager.roomOf(uid);
      const snapshot = await syncSnapshot(session);
      hub.sendTo(session, Ev.SysHello, {
        uid,
        serverTime: Date.now(),
        resume: snapshot !== null,
        snapshot,
      });
      if (room) room.host.onReconnect(room, uid);

      socket.on('message', (buf) => {
        const raw = buf.toString();
        if (raw.length > 16384) {
          socket.close(4400, 'message too large');
          return;
        }
        void handleMessage(session, raw);
      });
      socket.on('close', () => {
        hub.markOffline(uid, socket);
      });
      socket.on('error', () => {
        /* close 事件处理 */
      });
    })();
  });

  // 心跳超时清理 + 在线心跳续期
  setInterval(() => {
    const now = Date.now();
    for (const s of hub.sessions.values()) {
      if (s.socket && now - s.lastSeenAt > 30000) {
        try {
          s.socket.close(4408, 'heartbeat timeout');
        } catch {
          /* noop */
        }
      } else if (s.socket) {
        void getRedis().set(`online:${s.uid}`, '1', 'EX', 120).catch(() => undefined);
      }
    }
  }, 10000).unref();

  // 离线/踢线联动
  hub.onOffline = (s) => {
    const room = roomManager.roomOf(s.uid);
    if (room) room.host.onOffline(room, s.uid);
  };
  hub.onGone = (s) => {
    const room = roomManager.roomOf(s.uid);
    if (room) {
      const p = room.playerByUid(s.uid);
      if (p && room.state === 'waiting') {
        void roomManager.removePlayer(room, s.uid, 'timeout');
      }
      // 对局中：保持托管打完（结算仍会入账）
    }
    if (fishingHost.isIn(s.uid)) void fishingHost.leave(s);
    slotHost.leave(s);
    cancelMatch(s.uid);
  };

  log.info({ port }, 'game gateway listening');
  return wss;
}

/** 后台踢线：订阅具体频道 */
export function wireUserBus(): void {
  // Redis psubscribe bus.* 已在 server-core 建立；这里注册处理器
  const handler = (payload: Record<string, unknown>, uid: number): void => {
    if (payload.kind === 'kick') {
      const s = hub.get(uid);
      if (s?.socket) {
        hub.sendTo(s, Ev.SysKicked, { reason: payload.reason ?? 'admin' });
        try {
          s.socket.close(4001, 'kicked');
        } catch {
          /* noop */
        }
      }
      hub.remove(uid);
    }
  };
  // 订阅所有会话的用户频道由 pmessage 分发；hub 侧按需绑定
  busSubscribeDynamic(handler);
}

let dynamicBound = false;
function busSubscribeDynamic(handler: (p: Record<string, unknown>, uid: number) => void): void {
  if (dynamicBound) return;
  dynamicBound = true;
  // 直接监听 pmessage：频道格式 bus.user.<uid>
  import('@yanbian/server-core').then(({ getRedisSub }) => {
    const sub = getRedisSub();
    sub.on('pmessage', (_p: string, channel: string, message: string) => {
      const m = /^bus\.user\.(\d+)$/.exec(channel);
      if (!m) return;
      try {
        handler(JSON.parse(message) as Record<string, unknown>, Number(m[1]));
      } catch {
        /* ignore */
      }
    });
    void sub.psubscribe('bus.*');
  });
}
