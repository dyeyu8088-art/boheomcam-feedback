/** 后台 API 客户端 */
import { ElMessage } from 'element-plus';

export interface AdminSession {
  token: string;
  adminId: number;
  displayName: string;
  permissions: string[];
  mustChangePassword: boolean;
}

export function session(): AdminSession | null {
  return JSON.parse(localStorage.getItem('adminSession') ?? 'null');
}

export function setSession(s: AdminSession | null): void {
  if (s) localStorage.setItem('adminSession', JSON.stringify(s));
  else localStorage.removeItem('adminSession');
}

export function can(perm: string): boolean {
  return session()?.permissions.includes(perm) ?? false;
}

export async function api<T = Record<string, unknown>>(path: string, body?: unknown, silent = false): Promise<T> {
  const res = await fetch(path, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(session()?.token ? { authorization: `Bearer ${session()!.token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = (await res.json()) as { code: number; msg: string; data: T };
  if (payload.code === 0) return payload.data;
  if (payload.code === 6000 || payload.code === 2001 || payload.code === 2002) {
    setSession(null);
    location.hash = '#/login';
  }
  if (!silent) ElMessage.error(payload.msg || `错误 ${payload.code}`);
  throw Object.assign(new Error(payload.msg), { code: payload.code });
}
