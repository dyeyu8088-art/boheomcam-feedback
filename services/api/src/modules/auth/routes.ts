import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode } from '@yanbian/protocol';
import { rateLimit } from '@yanbian/server-core';
import { ok, requireUser } from '../../server.js';
import * as auth from './service.js';

interface DeviceBody {
  deviceId?: string;
  deviceType?: string;
  osVersion?: string;
  appVersion?: string;
}

/** 登录限流阈值（次/分/IP）。压测环境可调高；生产保持默认。 */
const AUTH_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT ?? 20);

function device(body: DeviceBody): auth.DeviceInfo {
  const deviceId = (body.deviceId ?? '').trim();
  if (!deviceId || deviceId.length > 128) throw new ApiError(ErrorCode.VALIDATION, '缺少设备标识');
  return {
    deviceId,
    deviceType: body.deviceType?.slice(0, 32),
    osVersion: body.osVersion?.slice(0, 64),
    appVersion: body.appVersion?.slice(0, 32),
  };
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post('/api/v1/auth/guest', async (req) => {
    if (!(await rateLimit(`auth:${req.ip}`, AUTH_RATE_LIMIT, 60))) throw new ApiError(ErrorCode.RATE_LIMITED, undefined, 429);
    const body = req.body as DeviceBody & { guestKey?: string };
    const r = await auth.guestLogin((body.guestKey ?? '').trim(), device(body), req.ip);
    return ok(r);
  });

  app.post('/api/v1/auth/sms/send', async (req) => {
    if (!(await rateLimit(`sms:${req.ip}`, 5, 300))) throw new ApiError(ErrorCode.SMS_TOO_FREQUENT, undefined, 429);
    const body = req.body as { phone?: string; purpose?: string };
    const r = await auth.sendSmsCode((body.phone ?? '').trim(), body.purpose ?? 'login', req.ip);
    return ok(r);
  });

  app.post('/api/v1/auth/sms/login', async (req) => {
    if (!(await rateLimit(`auth:${req.ip}`, AUTH_RATE_LIMIT, 60))) throw new ApiError(ErrorCode.RATE_LIMITED, undefined, 429);
    const body = req.body as DeviceBody & { phone?: string; code?: string; password?: string };
    const pwd = body.password && body.password.length >= 6 && body.password.length <= 64 ? body.password : null;
    const r = await auth.smsLogin((body.phone ?? '').trim(), (body.code ?? '').trim(), pwd, device(body), req.ip);
    return ok(r);
  });

  app.post('/api/v1/auth/password/login', async (req) => {
    if (!(await rateLimit(`auth:${req.ip}`, AUTH_RATE_LIMIT, 60))) throw new ApiError(ErrorCode.RATE_LIMITED, undefined, 429);
    const body = req.body as DeviceBody & { phone?: string; password?: string };
    if (!body.password) throw new ApiError(ErrorCode.VALIDATION, '缺少密码');
    const r = await auth.passwordLogin((body.phone ?? '').trim(), body.password, device(body), req.ip);
    return ok(r);
  });

  app.post('/api/v1/auth/refresh', async (req) => {
    if (!(await rateLimit(`refresh:${req.ip}`, 30, 60))) throw new ApiError(ErrorCode.RATE_LIMITED, undefined, 429);
    const body = req.body as DeviceBody & { refreshToken?: string };
    if (!body.refreshToken) throw new ApiError(ErrorCode.VALIDATION, '缺少 refreshToken');
    const r = await auth.refreshTokens(body.refreshToken, device(body), req.ip);
    return ok(r);
  });

  app.post('/api/v1/auth/logout', { preHandler: requireUser }, async (req) => {
    await auth.logout(req.authedUser!.uid);
    return ok();
  });
}
