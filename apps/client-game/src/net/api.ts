/** REST 客户端：统一响应解包、401 自动刷新重试、设备标识 */
import { ApiError, type ApiResp } from '@yanbian/protocol';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export function deviceId(): string {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem('deviceId', id);
  }
  return id;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  sessionKey: string;
}

let tokens: Tokens | null = JSON.parse(localStorage.getItem('tokens') ?? 'null');
let refreshing: Promise<boolean> | null = null;
export const onUnauthorized: { handler: (() => void) | null } = { handler: null };

export function setTokens(t: Tokens | null): void {
  tokens = t;
  if (t) localStorage.setItem('tokens', JSON.stringify(t));
  else localStorage.removeItem('tokens');
}

export function getAccessToken(): string | null {
  return tokens?.accessToken ?? null;
}

export function hasSession(): boolean {
  return !!tokens?.refreshToken;
}

async function tryRefresh(): Promise<boolean> {
  if (!tokens?.refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens!.refreshToken, deviceId: deviceId(), deviceType: platformType() }),
        });
        const body = (await res.json()) as ApiResp<Tokens>;
        if (body.code === 0) {
          setTokens(body.data);
          return true;
        }
        setTokens(null);
        return false;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export function platformType(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad/i.test(ua)) return 'ios';
  return 'pc';
}

export async function api<T = Record<string, unknown>>(path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = (await res.json()) as ApiResp<T>;
  if (payload.code === 0) return payload.data;
  if ((payload.code === 2001 || payload.code === 2002 || payload.code === 2000) && retry) {
    if (await tryRefresh()) return api<T>(path, body, false);
    onUnauthorized.handler?.();
  }
  throw new ApiError(payload.code as never, payload.msg);
}
