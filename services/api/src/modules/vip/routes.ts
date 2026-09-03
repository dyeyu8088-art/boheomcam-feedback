/** vip-service：VIP 等级由经验阈值（vip_levels）决定，经验在结算服务累加；每日礼包走 wallet（幂等） */
import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode } from '@yanbian/protocol';
import { query, withTx } from '@yanbian/server-core';
import { postTransactionInTx, SYS } from '@yanbian/wallet';
import { ok, requireUser } from '../../server.js';

interface VipLevelRow {
  level: number;
  exp_required: string | number;
  name: string;
  name_ko: string;
  perks: { dailyBonus?: number; bonusRateBp?: number; frame?: string };
}

export async function vipStatus(uid: number): Promise<{
  level: number;
  exp: number;
  expRequired: number;
  next: { level: number; expRequired: number } | null;
  perks: VipLevelRow['perks'];
  levels: { level: number; expRequired: number; name: string; nameKo: string; perks: VipLevelRow['perks'] }[];
}> {
  const [p, lv] = await Promise.all([
    query('SELECT vip, exp FROM user_profiles WHERE user_id=$1', [uid]),
    query('SELECT level, exp_required, name, name_ko, perks FROM vip_levels ORDER BY level'),
  ]);
  const exp = Number(p.rows[0]?.exp ?? 0);
  const rows = lv.rows as VipLevelRow[];
  const reached = rows.filter((r) => Number(r.exp_required) <= exp);
  const cur = reached[reached.length - 1] ?? rows[0]!;
  const next = rows.find((r) => r.level === cur.level + 1) ?? null;
  return {
    level: cur.level,
    exp,
    expRequired: Number(cur.exp_required),
    next: next ? { level: next.level, expRequired: Number(next.exp_required) } : null,
    perks: cur.perks ?? {},
    levels: rows.map((r) => ({ level: r.level, expRequired: Number(r.exp_required), name: r.name, nameKo: r.name_ko, perks: r.perks ?? {} })),
  };
}

export function registerVipRoutes(app: FastifyInstance): void {
  app.get('/api/v1/vip', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const status = await vipStatus(uid);
    const today = new Date().toISOString().slice(0, 10);
    const claimed = await query(`SELECT 1 FROM wallet_transactions WHERE idempotency_key=$1`, [`vip:daily:${uid}:${today}`]);
    return ok({ ...status, dailyClaimed: claimed.rowCount! > 0 });
  });

  /** VIP 每日礼包（perks.dailyBonus）：幂等键 = 用户 + 日期，重复领取被钱包层拒绝 */
  app.post('/api/v1/vip/daily', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const status = await vipStatus(uid);
    const bonus = Number(status.perks.dailyBonus ?? 0);
    if (bonus <= 0) throw new ApiError(ErrorCode.NOT_FOUND, '当前 VIP 等级无每日礼包');
    const today = new Date().toISOString().slice(0, 10);
    return withTx(async (c) => {
      const posted = await postTransactionInTx(c, {
        idempotencyKey: `vip:daily:${uid}:${today}`,
        userId: uid,
        currency: 'COIN',
        type: 'VIP_DAILY',
        amount: bonus,
        systemAccount: SYS.ACTIVITY,
        description: `VIP${status.level} 每日礼包`,
      });
      if (posted.duplicated) throw new ApiError(ErrorCode.DUPLICATE_TRANSACTION, '今日已领取');
      return ok({ amount: bonus, balanceAfter: posted.balanceAfter });
    });
  });
}
