/** Fastify 实例构建：统一响应、错误映射、鉴权装饰、限流、指标 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { ApiError, ErrorCode, ErrorMessage } from '@yanbian/protocol';
import { counterInc, getLogger, loadEnv, rateLimit, renderMetrics, verifyJwt } from '@yanbian/server-core';

const log = getLogger('api');

export interface AuthedUser {
  uid: number;
  deviceId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authedUser?: AuthedUser;
    adminId?: number;
    adminPerms?: Set<string>;
  }
}

export function ok(data: unknown = {}): { code: number; msg: string; data: unknown } {
  return { code: 0, msg: 'OK', data };
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  app.addHook('onRequest', async (req, reply) => {
    counterInc('api_requests_total', `path="${req.routeOptions.url ?? 'unknown'}"`);
    // 全局 IP 限流（业务级更细的在各路由）
    const allowed = await rateLimit(`ip:${req.ip}`, 600, 60).catch(() => true);
    if (!allowed) {
      counterInc('api_rate_limited_total');
      await reply.status(429).send({ code: ErrorCode.RATE_LIMITED, msg: ErrorMessage[ErrorCode.RATE_LIMITED], data: {} });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      void reply.status(err.httpStatus).send({ code: err.code, msg: err.message, data: {} });
      return;
    }
    const anyErr = err as { statusCode?: number; message?: string };
    if (anyErr.statusCode && anyErr.statusCode < 500) {
      void reply.status(anyErr.statusCode).send({ code: ErrorCode.BAD_REQUEST, msg: anyErr.message ?? 'bad request', data: {} });
      return;
    }
    const e = err as Error;
    log.error({ path: req.url, err: e.message, stack: e.stack }, 'unhandled error');
    counterInc('api_errors_total');
    void reply.status(500).send({ code: ErrorCode.INTERNAL, msg: ErrorMessage[ErrorCode.INTERNAL], data: {} });
  });

  app.get('/healthz', async () => ok({ up: true }));
  app.get('/metrics', async (_req, reply) => reply.type('text/plain').send(renderMetrics()));

  return app;
}

/** 用户鉴权前置：Authorization: Bearer <jwt> */
export async function requireUser(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(ErrorCode.AUTH_REQUIRED, undefined, 401);
  const payload = verifyJwt(header.slice(7), loadEnv().jwtSecret);
  if (!payload || payload.typ !== 'user') throw new ApiError(ErrorCode.TOKEN_INVALID, undefined, 401);
  req.authedUser = { uid: payload.sub, deviceId: (payload.dev as string) ?? '' };
}

/** 用户级限流助手 */
export async function userRateLimit(req: FastifyRequest, scope: string, limit: number, windowSec: number): Promise<void> {
  const uid = req.authedUser?.uid ?? req.ip;
  const allowed = await rateLimit(`${scope}:${uid}`, limit, windowSec);
  if (!allowed) throw new ApiError(ErrorCode.RATE_LIMITED, undefined, 429);
}
