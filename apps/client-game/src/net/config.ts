/**
 * 服务器地址：Web/H5 默认同源（Nginx 统一转发 /api 与 /ws）；
 * APK（WebView 壳）或独立测试时可在登录页填写，保存在 localStorage，也可通过 ?server= 参数一次性写入。
 * 例：http://192.168.1.10:5173（开发机 vite，自带 /api /ws 代理）或 https://play.example.com
 */
const KEY = 'serverBase';

function trim(v: string): string {
  return v.trim().replace(/\/+$/, '');
}

export function getServerBase(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return trim(v);
  } catch {
    /* 隐私模式等 */
  }
  return trim((import.meta.env.VITE_SERVER_BASE as string | undefined) ?? '');
}

export function setServerBase(v: string): void {
  const t = trim(v);
  if (t) localStorage.setItem(KEY, t);
  else localStorage.removeItem(KEY);
}

/** 是否运行在 APK 壳内（壳会在 UA 追加标识） */
export function isNativeShell(): boolean {
  return /YanbianGameApp\//.test(navigator.userAgent);
}

export function apiBase(): string {
  return getServerBase() || trim((import.meta.env.VITE_API_BASE as string | undefined) ?? '');
}

export function wsBase(): string {
  const b = getServerBase();
  if (b) return b.replace(/^http/i, 'ws');
  const env = import.meta.env.VITE_WS_BASE as string | undefined;
  if (env) return trim(env);
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}
