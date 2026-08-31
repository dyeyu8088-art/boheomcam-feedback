/**
 * 加密工具：JWT(HS256)、scrypt 口令散列、HMAC 请求签名。
 * 口令散列采用 Node 内置 scrypt（N=16384,r=8,p=1 + 16B 盐）。
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const b64u = (buf: Buffer): string => buf.toString('base64url');
const fromB64u = (s: string): Buffer => Buffer.from(s, 'base64url');

// ── JWT ──────────────────────────────────────────────────────
export interface JwtPayload {
  sub: number;         // uid / adminId
  typ: 'user' | 'admin';
  dev?: string;        // deviceId
  iat: number;
  exp: number;
  [k: string]: unknown;
}

export function signJwt(payload: JwtPayload, secret: string): string {
  const header = b64u(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64u(sig)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expect = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const got = fromB64u(sig);
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const payload = JSON.parse(fromB64u(body).toString()) as JwtPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── 口令散列 ─────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `s1$${b64u(salt)}$${b64u(hash)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 's1') return false;
  const salt = fromB64u(parts[1]!);
  const expect = fromB64u(parts[2]!);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return hash.length === expect.length && timingSafeEqual(hash, expect);
}

// ── HMAC 请求/消息签名 ───────────────────────────────────────
export function hmacSign(sessionKey: string, parts: (string | number)[]): string {
  return createHmac('sha256', sessionKey).update(parts.join('|')).digest('hex');
}

export function hmacVerify(sessionKey: string, parts: (string | number)[], sig: string): boolean {
  const expect = hmacSign(sessionKey, parts);
  const a = Buffer.from(expect);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
