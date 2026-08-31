/**
 * SessionHub：uid → 连接会话。心跳、seq 过滤、requestId 幂等、断线保活、单点登录踢线。
 */
import type { WebSocket } from 'ws';
import type { WsDown } from '@yanbian/protocol';
import { Ev } from '@yanbian/protocol';
import { counterInc, gaugeSet, getLogger, getRedis } from '@yanbian/server-core';

const log = getLogger('hub');

export interface GameSession {
  uid: number;
  deviceId: string;
  socket: WebSocket | null;
  lastSeq: number;
  pushSeq: number;
  lastSeenAt: number;
  roomId: number | null;
  gameCode: string | null;
  offlineSince: number | null;
  /** 断线清理定时器 */
  reaper: NodeJS.Timeout | null;
  /** requestId 短期去重 + 响应缓存 */
  recentRequests: Map<string, WsDown>;
}

export class SessionHub {
  sessions = new Map<number, GameSession>();
  onOffline: ((s: GameSession) => void) | null = null;
  onGone: ((s: GameSession) => void) | null = null;

  attach(uid: number, deviceId: string, socket: WebSocket): GameSession {
    const existing = this.sessions.get(uid);
    if (existing) {
      if (existing.socket && existing.socket.readyState === existing.socket.OPEN) {
        // 单点登录：踢旧连接
        this.sendTo(existing, Ev.SysKicked, { reason: 'other_login' });
        try {
          existing.socket.close(4001, 'kicked');
        } catch {
          /* noop */
        }
        counterInc('ws_kicked_total');
      }
      if (existing.reaper) clearTimeout(existing.reaper);
      existing.socket = socket;
      existing.deviceId = deviceId;
      existing.offlineSince = null;
      existing.reaper = null;
      existing.lastSeenAt = Date.now();
      return existing;
    }
    const session: GameSession = {
      uid,
      deviceId,
      socket,
      lastSeq: 0,
      pushSeq: 0,
      lastSeenAt: Date.now(),
      roomId: null,
      gameCode: null,
      offlineSince: null,
      reaper: null,
      recentRequests: new Map(),
    };
    this.sessions.set(uid, session);
    this.trackOnline();
    return session;
  }

  /** 连接断开：进房间的保活等待重连（120s），否则 90s */
  markOffline(uid: number, socket: WebSocket): void {
    const s = this.sessions.get(uid);
    if (!s || s.socket !== socket) return; // 已被新连接顶替
    s.socket = null;
    s.offlineSince = Date.now();
    this.onOffline?.(s);
    const graceMs = s.roomId ? 120000 : 90000;
    s.reaper = setTimeout(() => this.remove(uid), graceMs);
    counterInc('ws_offline_total');
  }

  remove(uid: number): void {
    const s = this.sessions.get(uid);
    if (!s) return;
    if (s.reaper) clearTimeout(s.reaper);
    this.sessions.delete(uid);
    this.onGone?.(s);
    this.trackOnline();
    void getRedis().del(`online:${uid}`).catch(() => undefined);
  }

  get(uid: number): GameSession | undefined {
    return this.sessions.get(uid);
  }

  sendTo(session: GameSession, event: string, data: unknown, extra: Partial<WsDown> = {}): void {
    if (!session.socket || session.socket.readyState !== session.socket.OPEN) return;
    session.pushSeq += 1;
    const frame: WsDown = {
      v: 1,
      event,
      pushSeq: session.pushSeq,
      timestamp: Date.now(),
      code: 0,
      data,
      ...extra,
    };
    try {
      session.socket.send(JSON.stringify(frame));
    } catch (e) {
      log.warn({ uid: session.uid, err: (e as Error).message }, 'send failed');
    }
  }

  send(uid: number, event: string, data: unknown, extra: Partial<WsDown> = {}): void {
    const s = this.sessions.get(uid);
    if (s) this.sendTo(s, event, data, extra);
  }

  private trackOnline(): void {
    gaugeSet('ws_sessions', this.sessions.size);
    void getRedis().set('online:total', String(this.sessions.size)).catch(() => undefined);
  }
}

export const hub = new SessionHub();
