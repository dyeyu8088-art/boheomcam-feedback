/** inventory-service：背包（道具目录 + 持有数量）。道具增减只在事务内配合 user_item_logs 幂等记录。 */
import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { ApiError, ErrorCode } from '@yanbian/protocol';
import { query } from '@yanbian/server-core';
import { ok, requireUser } from '../../server.js';

/** 事务内增减道具（delta 可负）；同一 idempotencyKey 只生效一次 */
export async function grantItemInTx(c: PoolClient, params: { userId: number; itemId: string; delta: number; reason: string; refId?: string; idempotencyKey: string }): Promise<{ qty: number; duplicated: boolean }> {
  const dup = await c.query('SELECT 1 FROM user_item_logs WHERE idempotency_key=$1', [params.idempotencyKey]);
  if (dup.rowCount) {
    const q = await c.query('SELECT qty FROM user_items WHERE user_id=$1 AND item_id=$2', [params.userId, params.itemId]);
    return { qty: Number(q.rows[0]?.qty ?? 0), duplicated: true };
  }
  if (params.delta < 0) {
    const cur = await c.query('SELECT qty FROM user_items WHERE user_id=$1 AND item_id=$2 FOR UPDATE', [params.userId, params.itemId]);
    if (Number(cur.rows[0]?.qty ?? 0) + params.delta < 0) throw new ApiError(ErrorCode.BAD_REQUEST, '道具数量不足');
  }
  const r = await c.query(
    `INSERT INTO user_items (user_id, item_id, qty) VALUES ($1,$2,GREATEST($3,0))
     ON CONFLICT (user_id, item_id) DO UPDATE SET qty = user_items.qty + $3, updated_at = now()
     RETURNING qty`,
    [params.userId, params.itemId, params.delta],
  );
  await c.query('INSERT INTO user_item_logs (user_id, item_id, delta, reason, ref_id, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6)', [
    params.userId,
    params.itemId,
    params.delta,
    params.reason,
    params.refId ?? null,
    params.idempotencyKey,
  ]);
  return { qty: Number(r.rows[0]!.qty), duplicated: false };
}

export function registerInventoryRoutes(app: FastifyInstance): void {
  app.get('/api/v1/inventory', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const [mine, catalog] = await Promise.all([
      query(
        `SELECT ui.item_id, ui.qty, i.kind, i.name, i.name_ko, i.icon, i.game_id, i.meta
         FROM user_items ui JOIN items i ON i.item_id = ui.item_id
         WHERE ui.user_id=$1 AND ui.qty > 0 ORDER BY i.kind, i.item_id`,
        [uid],
      ),
      query(`SELECT item_id, kind, name, name_ko, icon, game_id, meta FROM items WHERE status='active' ORDER BY kind, item_id`),
    ]);
    return ok({
      items: mine.rows.map((r) => ({ itemId: r.item_id, qty: Number(r.qty), kind: r.kind, name: r.name, nameKo: r.name_ko, icon: r.icon, gameId: r.game_id, meta: r.meta })),
      catalog: catalog.rows.map((r) => ({ itemId: r.item_id, kind: r.kind, name: r.name, nameKo: r.name_ko, icon: r.icon, gameId: r.game_id, meta: r.meta })),
    });
  });
}
