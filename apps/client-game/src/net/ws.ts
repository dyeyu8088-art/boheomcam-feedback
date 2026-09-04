/**
 * WS 客户端：seq 自增、requestId 幂等、心跳校时、指数退避重连、pushSeq 缺口重同步。
 */
import { Ev, type WsDown } from '@yanbian/protocol';
import { getAccessToken } from './api.js';
import { wsBase } from './config.js';

type Handler = (msg: WsDown) => void;


export class GameSocket {
  private ws: WebSocket | null = null;
  private seq = 0;
  private lastPushSeq = 0;
  private handlers = new Map<string, Set<Handler>>();
  private pending = new Map<number, { resolve: (m: WsDown) => void; reject: (e: Error) => void; event: string; timer: number }>();
  private heartbeatTimer: number | null = null;
  private reconnectAttempt = 0;
  private closedByUser = false;
  serverTimeOffset = 0;
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' = 'idle';
  onStatus: ((s: GameSocket['status']) => void) | null = null;

  connect(): Promise<void> {
    this.closedByUser = false;
    return this.open();
  }

  private open(): Promise<void> {
    const token = getAccessToken();
    if (!token) return Promise.reject(new Error('no token'));
    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsBase()}/ws?token=${encodeURIComponent(token)}`);
      this.ws = ws;
      const failTimer = window.setTimeout(() => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
        reject(new Error('connect timeout'));
      }, 8000);
      ws.onopen = () => {
        window.clearTimeout(failTimer);
        this.reconnectAttempt = 0;
        this.lastPushSeq = 0;
        this.setStatus('open');
        this.startHeartbeat();
        resolve();
      };
      ws.onmessage = (ev) => this.onMessage(ev.data as string);
      ws.onclose = () => {
        window.clearTimeout(failTimer);
        this.stopHeartbeat();
        for (const [, p] of this.pending) {
          window.clearTimeout(p.timer);
          p.reject(new Error('connection closed'));
        }
        this.pending.clear();
        if (!this.closedByUser) this.scheduleReconnect();
        else this.setStatus('closed');
      };
      ws.onerror = () => {
        /* onclose 处理 */
      };
    });
  }

  private setStatus(s: GameSocket['status']): void {
    this.status = s;
    this.onStatus?.(s);
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting');
    const delay = Math.min(8000, 500 * 2 ** this.reconnectAttempt) + Math.random() * 400;
    this.reconnectAttempt += 1;
    window.setTimeout(() => {
      if (this.closedByUser) return;
      void this.open().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.send(Ev.SysPing, { t: Date.now() });
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private onMessage(raw: string): void {
    let msg: WsDown;
    try {
      msg = JSON.parse(raw) as WsDown;
    } catch {
      return;
    }
    if (msg.event === Ev.SysPong) {
      const d = msg.data as { t: number; serverTime: number };
      const rtt = Date.now() - d.t;
      this.serverTimeOffset = d.serverTime + rtt / 2 - Date.now();
      return;
    }
    // pushSeq 缺口 → 全量重同步
    if (msg.pushSeq !== undefined) {
      if (this.lastPushSeq !== 0 && msg.pushSeq > this.lastPushSeq + 1) {
        this.lastPushSeq = msg.pushSeq;
        this.emit('local.resyncNeeded', msg);
      } else {
        this.lastPushSeq = Math.max(this.lastPushSeq, msg.pushSeq);
      }
    }
    if (msg.ack !== undefined) {
      const p = this.pending.get(msg.ack);
      if (p) {
        this.pending.delete(msg.ack);
        window.clearTimeout(p.timer);
        if (msg.event === Ev.SysError) p.reject(Object.assign(new Error((msg.data as { msg?: string })?.msg ?? 'error'), { code: (msg.data as { code?: number })?.code, data: msg.data }));
        else p.resolve(msg);
      }
    }
    this.emit(msg.event, msg);
  }

  serverNow(): number {
    return Date.now() + this.serverTimeOffset;
  }

  send(event: string, data: unknown = {}, requestId?: string): number {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return -1;
    this.seq += 1;
    this.ws.send(JSON.stringify({ v: 1, event, seq: this.seq, timestamp: Date.now(), data, requestId }));
    return this.seq;
  }

  /** 请求-响应（带超时；requestId 保证服务端幂等） */
  call<T = Record<string, unknown>>(event: string, data: unknown = {}, timeoutMs = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = `c-${crypto.randomUUID().slice(0, 18)}`;
      const seq = this.send(event, data, requestId);
      if (seq < 0) {
        reject(new Error('not connected'));
        return;
      }
      const timer = window.setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`timeout: ${event}`));
      }, timeoutMs);
      this.pending.set(seq, { resolve: (m) => resolve(m.data as T), reject, event, timer });
    });
  }

  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  private emit(event: string, msg: WsDown): void {
    const set = this.handlers.get(event);
    if (set) for (const h of [...set]) h(msg);
    const any = this.handlers.get('*');
    if (any) for (const h of [...any]) h(msg);
  }

  close(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;
    this.setStatus('closed');
  }
}

export const gameSocket = new GameSocket();
