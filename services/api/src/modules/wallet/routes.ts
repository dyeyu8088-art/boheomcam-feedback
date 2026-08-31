import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode } from '@yanbian/protocol';
import { loadEnv, query } from '@yanbian/server-core';
import { ok, requireUser } from '../../server.js';
import { getBalances, postSettlement, type SettleInput } from '@yanbian/wallet';

export function registerWalletRoutes(app: FastifyInstance): void {
  app.get('/api/v1/wallet/balances', { preHandler: requireUser }, async (req) => {
    return ok(await getBalances(req.authedUser!.uid));
  });

  app.get('/api/v1/wallet/transactions', { preHandler: requireUser }, async (req) => {
    const q = req.query as { page?: string; currency?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const params: unknown[] = [req.authedUser!.uid];
    let cond = 'user_id=$1';
    if (q.currency) {
      params.push(q.currency);
      cond += ` AND currency=$${params.length}`;
    }
    params.push(20, (page - 1) * 20);
    const r = await query(
      `SELECT transaction_id, currency, type, amount, balance_after, game_id, round_id, description, created_at
       FROM wallet_transactions WHERE ${cond}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok({ page, items: r.rows });
  });

  /** 内部结算入口：仅 game-service 携带 INTERNAL_TOKEN 调用 */
  app.post('/internal/wallet/settle', async (req) => {
    if (req.headers['x-internal-token'] !== loadEnv().internalToken) {
      throw new ApiError(ErrorCode.ADMIN_FORBIDDEN, 'internal only', 403);
    }
    const input = req.body as SettleInput;
    if (!input || !Number.isInteger(input.roundId) || !Array.isArray(input.entries)) {
      throw new ApiError(ErrorCode.VALIDATION);
    }
    const result = await postSettlement(input);
    return ok(result);
  });
}
