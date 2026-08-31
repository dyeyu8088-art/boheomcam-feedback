/**
 * auth-service：游客/手机号+密码/短信验证码登录、双 Token、设备与登录日志、封禁检查、强制下线。
 */
import type { PoolClient } from 'pg';
import { ApiError, ErrorCode, type TokenPair } from '@yanbian/protocol';
import {
  getLogger,
  getRedis,
  hashPassword,
  loadEnv,
  loginFailCount,
  loginFailReset,
  nextUid,
  query,
  randomToken,
  sha256hex,
  signJwt,
  verifyPassword,
  withTx,
} from '@yanbian/server-core';
import { ensureAccounts, postTransactionInTx, SYS } from '@yanbian/wallet';

const log = getLogger('auth');

const NICK_POOL = ['长白山客', '图们江畔', '金达莱', '海兰江', '延吉之星', '珲春旅人', '和龙牌手', '敦化雅士'];

export interface DeviceInfo {
  deviceId: string;
  deviceType?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface LoginResult extends TokenPair {
  uid: number;
  isNew: boolean;
}

const INIT_COINS = 100000; // 新用户虚拟金币（后台可配，此为默认发放）
const INIT_DIAMONDS = 100;

async function assertNotBanned(uid: number | null, deviceId: string, ip: string): Promise<void> {
  const r = await query(
    `SELECT 1 FROM bans WHERE lifted_at IS NULL AND (until_at IS NULL OR until_at > now())
      AND ((target_type='user' AND target=$1) OR (target_type='device' AND target=$2) OR (target_type='ip' AND target=$3))
      LIMIT 1`,
    [uid === null ? '' : String(uid), deviceId, ip],
  );
  if (r.rowCount) throw new ApiError(ErrorCode.ACCOUNT_BANNED, undefined, 403);
}

async function createUser(client: PoolClient, opts: { guestKey?: string; phone?: string; passwordHash?: string; ip: string }): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const uid = nextUid();
    try {
      await client.query(
        `INSERT INTO users (id, guest_key, phone, password_hash, created_ip) VALUES ($1,$2,$3,$4,$5)`,
        [uid, opts.guestKey ?? null, opts.phone ?? null, opts.passwordHash ?? null, opts.ip],
      );
      const nick = `${NICK_POOL[uid % NICK_POOL.length]}${String(uid).slice(-4)}`;
      await client.query(
        `INSERT INTO user_profiles (user_id, nickname, avatar_id) VALUES ($1,$2,$3)`,
        [uid, nick, (uid % 12) + 1],
      );
      await ensureAccounts(client, uid);
      await postTransactionInTx(client, {
        idempotencyKey: `init:coin:${uid}`,
        userId: uid,
        currency: 'COIN',
        type: 'INIT_GRANT',
        amount: INIT_COINS,
        systemAccount: SYS.ISSUER,
        description: '新用户初始金币（虚拟娱乐资产）',
      });
      await postTransactionInTx(client, {
        idempotencyKey: `init:diamond:${uid}`,
        userId: uid,
        currency: 'DIAMOND',
        type: 'INIT_GRANT',
        amount: INIT_DIAMONDS,
        systemAccount: SYS.ISSUER,
        description: '新用户初始钻石（虚拟娱乐资产）',
      });
      return uid;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('users_pkey')) continue; // UID 撞号重试
      throw e;
    }
  }
  throw new ApiError(ErrorCode.INTERNAL, 'UID 分配失败');
}

async function issueTokens(uid: number, device: DeviceInfo, ip: string, loginType: string, isNew: boolean): Promise<LoginResult> {
  const env = loadEnv();
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({ sub: uid, typ: 'user', dev: device.deviceId, iat: now, exp: now + env.jwtAccessTtlSec }, env.jwtSecret);
  const refreshToken = randomToken(32);
  const sessionKey = randomToken(24);
  await query(
    `INSERT INTO refresh_tokens (token_hash, user_id, device_id, expires_at)
     VALUES ($1,$2,$3, now() + ($4 || ' days')::interval)`,
    [sha256hex(refreshToken), uid, device.deviceId, String(env.refreshTtlDays)],
  );
  const redis = getRedis();
  await redis.set(`sesskey:${uid}`, sessionKey, 'EX', env.refreshTtlDays * 86400);
  // 单点登录：记录当前活跃设备，游戏网关据此踢旧连接
  await redis.set(`activedev:${uid}`, device.deviceId, 'EX', env.refreshTtlDays * 86400);
  await query(
    `INSERT INTO user_devices (user_id, device_id, device_type, os_version, app_version, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (user_id, device_id) DO UPDATE SET last_seen_at=now(), device_type=EXCLUDED.device_type,
       os_version=EXCLUDED.os_version, app_version=EXCLUDED.app_version`,
    [uid, device.deviceId, device.deviceType ?? null, device.osVersion ?? null, device.appVersion ?? null],
  );
  await query(`UPDATE users SET last_login_at=now(), last_login_ip=$2 WHERE id=$1`, [uid, ip]);
  await query(
    `INSERT INTO user_login_logs (user_id, login_type, ip, device_id, result) VALUES ($1,$2,$3,$4,'ok')`,
    [uid, loginType, ip, device.deviceId],
  );
  return { uid, isNew, accessToken, refreshToken, sessionKey, accessExpiresIn: env.jwtAccessTtlSec };
}

export async function guestLogin(guestKey: string, device: DeviceInfo, ip: string): Promise<LoginResult> {
  if (!guestKey || guestKey.length < 8 || guestKey.length > 128) throw new ApiError(ErrorCode.VALIDATION, '游客标识无效');
  await assertNotBanned(null, device.deviceId, ip);
  const existing = await query('SELECT id, status FROM users WHERE guest_key=$1', [guestKey]);
  if (existing.rowCount) {
    const u = existing.rows[0]!;
    if (u.status !== 'normal') throw new ApiError(ErrorCode.ACCOUNT_BANNED, undefined, 403);
    await assertNotBanned(u.id, device.deviceId, ip);
    return issueTokens(u.id, device, ip, 'guest', false);
  }
  const uid = await withTx((c) => createUser(c, { guestKey, ip }));
  log.info({ uid }, 'guest user created');
  return issueTokens(uid, device, ip, 'guest', true);
}

const PHONE_RE = /^1\d{10}$/;

export async function sendSmsCode(phone: string, purpose: string, ip: string): Promise<{ devCode?: string }> {
  if (!PHONE_RE.test(phone)) throw new ApiError(ErrorCode.VALIDATION, '手机号格式错误');
  const recent = await query(
    `SELECT 1 FROM sms_codes WHERE phone=$1 AND created_at > now() - interval '60 seconds' LIMIT 1`,
    [phone],
  );
  if (recent.rowCount) throw new ApiError(ErrorCode.SMS_TOO_FREQUENT, undefined, 429);
  const code = String(100000 + Math.floor(Math.random() * 900000));
  await query(
    `INSERT INTO sms_codes (phone, code_hash, purpose, send_ip, expires_at)
     VALUES ($1,$2,$3,$4, now() + interval '5 minutes')`,
    [phone, sha256hex(code), purpose, ip],
  );
  // 生产环境接第三方短信网关（此处仅打日志）；非生产回显便于联调
  log.info({ phone: phone.slice(0, 3) + '****' + phone.slice(-2), purpose }, 'sms code issued');
  const env = loadEnv();
  return env.nodeEnv === 'production' ? {} : { devCode: code };
}

async function consumeSmsCode(phone: string, code: string): Promise<void> {
  const r = await query(
    `UPDATE sms_codes SET used_at=now()
     WHERE id = (SELECT id FROM sms_codes WHERE phone=$1 AND code_hash=$2 AND used_at IS NULL AND expires_at > now()
                 ORDER BY id DESC LIMIT 1)
     RETURNING id`,
    [phone, sha256hex(code)],
  );
  if (!r.rowCount) throw new ApiError(ErrorCode.SMS_CODE_INVALID);
}

/** 验证码登录（未注册自动注册）；可携带 password 完成设置密码 */
export async function smsLogin(phone: string, code: string, password: string | null, device: DeviceInfo, ip: string): Promise<LoginResult> {
  if (!PHONE_RE.test(phone)) throw new ApiError(ErrorCode.VALIDATION, '手机号格式错误');
  const fails = await loginFailCount(`sms:${ip}`);
  if (fails > 20) throw new ApiError(ErrorCode.RATE_LIMITED, undefined, 429);
  await consumeSmsCode(phone, code);
  await assertNotBanned(null, device.deviceId, ip);
  const existing = await query('SELECT id, status FROM users WHERE phone=$1', [phone]);
  let uid: number;
  let isNew = false;
  if (existing.rowCount) {
    const u = existing.rows[0]!;
    if (u.status !== 'normal') throw new ApiError(ErrorCode.ACCOUNT_BANNED, undefined, 403);
    uid = u.id;
    if (password) {
      await query('UPDATE users SET password_hash=$2 WHERE id=$1', [uid, hashPassword(password)]);
    }
  } else {
    uid = await withTx((c) => createUser(c, { phone, passwordHash: password ? hashPassword(password) : undefined, ip }));
    isNew = true;
  }
  await loginFailReset(`sms:${ip}`);
  return issueTokens(uid, device, ip, 'sms', isNew);
}

export async function passwordLogin(phone: string, password: string, device: DeviceInfo, ip: string): Promise<LoginResult> {
  const failKey = `pwd:${phone}`;
  const fails = await loginFailCount(failKey);
  if (fails > 5) throw new ApiError(ErrorCode.RATE_LIMITED, '尝试过多，请 15 分钟后再试', 429);
  const r = await query('SELECT id, password_hash, status FROM users WHERE phone=$1', [phone]);
  if (!r.rowCount || !r.rows[0]!.password_hash || !verifyPassword(password, r.rows[0]!.password_hash)) {
    await query(
      `INSERT INTO user_login_logs (user_id, login_type, ip, device_id, result) VALUES ($1,'password',$2,$3,'bad_credentials')`,
      [r.rows[0]?.id ?? 0, ip, device.deviceId],
    );
    throw new ApiError(ErrorCode.BAD_CREDENTIALS, undefined, 401);
  }
  const u = r.rows[0]!;
  if (u.status !== 'normal') throw new ApiError(ErrorCode.ACCOUNT_BANNED, undefined, 403);
  await assertNotBanned(u.id, device.deviceId, ip);
  await loginFailReset(failKey);
  return issueTokens(u.id, device, ip, 'password', false);
}

/** 刷新（旋转：旧 token 立即作废；被重放 → 全设备下线） */
export async function refreshTokens(refreshToken: string, device: DeviceInfo, ip: string): Promise<LoginResult> {
  const hash = sha256hex(refreshToken);
  const r = await query(
    `SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash=$1`,
    [hash],
  );
  if (!r.rowCount) throw new ApiError(ErrorCode.REFRESH_INVALID, undefined, 401);
  const row = r.rows[0]!;
  if (row.revoked_at) {
    // 已旋转的 token 被重放：疑似盗用 → 撤销该用户全部 refresh
    await query(`UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [row.user_id]);
    await query(
      `INSERT INTO risk_events (user_id, type, severity, evidence) VALUES ($1,'refresh_replay','high',$2)`,
      [row.user_id, JSON.stringify({ ip, deviceId: device.deviceId })],
    );
    throw new ApiError(ErrorCode.REFRESH_INVALID, '凭证异常，请重新登录', 401);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) throw new ApiError(ErrorCode.REFRESH_INVALID, undefined, 401);
  const status = await query('SELECT status FROM users WHERE id=$1', [row.user_id]);
  if (status.rows[0]?.status !== 'normal') throw new ApiError(ErrorCode.ACCOUNT_BANNED, undefined, 403);
  await query(`UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1`, [row.id]);
  return issueTokens(row.user_id, device, ip, 'token', false);
}

export async function logout(uid: number): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [uid]);
  await getRedis().del(`sesskey:${uid}`, `activedev:${uid}`);
}

/** 后台强制下线 */
export async function forceLogout(uid: number): Promise<void> {
  await logout(uid);
  const { busPublish } = await import('@yanbian/server-core');
  await busPublish(`bus.user.${uid}`, { kind: 'kick', reason: 'admin' });
}
