/**
 * shop-service：商城（钻石 ↔ 金币 / 道具 的虚拟资产内部兑换，无充值）。
 * 购买 = 一个事务：扣价 → 发放（币 / 道具）→ 订单；idempotencyKey 由客户端生成，重复请求返回首单结果。
 */
import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode, type Currency } from '@yanbian/protocol';
import { nextId, query, withTx } from '@yanbian/server-core';
import { getBalances, postTransactionInTx, SYS } from '@yanbian/wallet';
import { ok, requireUser } from '../../server.js';
import { grantItemInTx } from '../inventory/routes.js';

interface ProductRow {
  product_id: string;
  name: string;
  name_ko: string;
  price_currency: Currency;
  price: string | number;
  grant_currency: Currency | null;
  grant_amount: string | number;
  grant_item: string | null;
  grant_qty: number;
  icon: string;
  sort: number;
  daily_limit: number;
}

export function registerShopRoutes(app: FastifyInstance): void {
  app.get('/api/v1/shop', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const [products, bought] = await Promise.all([
      query(`SELECT * FROM shop_products WHERE status='active' ORDER BY sort, product_id`),
      query(`SELECT product_id, count(*)::int AS n FROM shop_orders WHERE user_id=$1 AND created_at >= date_trunc('day', now()) GROUP BY product_id`, [uid]),
    ]);
    const boughtMap = new Map<string, number>(bought.rows.map((r) => [r.product_id as string, Number(r.n)]));
    return ok({
      products: (products.rows as ProductRow[]).map((p) => ({
        productId: p.product_id,
        name: p.name,
        nameKo: p.name_ko,
        priceCurrency: p.price_currency,
        price: Number(p.price),
        grantCurrency: p.grant_currency,
        grantAmount: Number(p.grant_amount),
        grantItem: p.grant_item,
        grantQty: p.grant_qty,
        icon: p.icon,
        dailyLimit: p.daily_limit,
        boughtToday: boughtMap.get(p.product_id) ?? 0,
      })),
    });
  });

  app.post('/api/v1/shop/purchase', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const body = (req.body ?? {}) as { productId?: string; idempotencyKey?: string };
    const productId = String(body.productId ?? '');
    const key = String(body.idempotencyKey ?? '');
    if (!productId || !/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new ApiError(ErrorCode.BAD_REQUEST, '参数错误');

    return withTx(async (c) => {
      // 重复请求：直接返回首单
      const dup = await c.query('SELECT order_id, product_id FROM shop_orders WHERE idempotency_key=$1', [`shop:${uid}:${key}`]);
      if (dup.rowCount) {
        const balances = await getBalances(uid);
        return ok({ orderId: String(dup.rows[0]!.order_id), duplicated: true, balances });
      }
      const pr = await c.query('SELECT * FROM shop_products WHERE product_id=$1 AND status=$2 FOR SHARE', [productId, 'active']);
      if (!pr.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '商品不存在');
      const p = pr.rows[0] as ProductRow;
      if (p.daily_limit > 0) {
        const n = await c.query(`SELECT count(*)::int AS n FROM shop_orders WHERE user_id=$1 AND product_id=$2 AND created_at >= date_trunc('day', now())`, [uid, productId]);
        if (Number(n.rows[0]!.n) >= p.daily_limit) throw new ApiError(ErrorCode.RATE_LIMITED, '今日购买次数已达上限');
      }
      const orderId = nextId();
      // 1) 扣价（余额不足由钱包层抛 INSUFFICIENT_BALANCE，整个事务回滚）
      const debit = await postTransactionInTx(c, {
        idempotencyKey: `shop:${uid}:${key}:debit`,
        userId: uid,
        currency: p.price_currency,
        type: 'SHOP_PURCHASE',
        amount: -Number(p.price),
        systemAccount: SYS.SHOP,
        referenceId: String(orderId),
        description: `购买 ${p.name}`,
        metadata: { productId },
      });
      // 2) 发放
      const granted: Record<string, number> = {};
      if (p.grant_currency && Number(p.grant_amount) > 0) {
        const g = await postTransactionInTx(c, {
          idempotencyKey: `shop:${uid}:${key}:grant`,
          userId: uid,
          currency: p.grant_currency,
          type: 'SHOP_GRANT',
          amount: Number(p.grant_amount),
          systemAccount: SYS.SHOP,
          referenceId: String(orderId),
          description: `商城发放 ${p.name}`,
        });
        granted[p.grant_currency] = g.balanceAfter;
      }
      if (p.grant_item && p.grant_qty > 0) {
        const r = await grantItemInTx(c, { userId: uid, itemId: p.grant_item, delta: p.grant_qty, reason: 'shop', refId: String(orderId), idempotencyKey: `shop:${uid}:${key}:item` });
        granted[`item:${p.grant_item}`] = r.qty;
      }
      // 3) 订单
      await c.query(
        `INSERT INTO shop_orders (order_id, user_id, product_id, price_currency, price, idempotency_key, status, tx_id) VALUES ($1,$2,$3,$4,$5,$6,'posted',$7)`,
        [orderId, uid, productId, p.price_currency, Number(p.price), `shop:${uid}:${key}`, debit.transactionId],
      );
      // 余额必须用事务内连接读取，否则看到的是提交前的旧值
      const bal = await c.query('SELECT currency, balance FROM wallet_accounts WHERE user_id=$1', [uid]);
      const balances = Object.fromEntries(bal.rows.map((r) => [r.currency as string, Number(r.balance)]));
      return ok({ orderId: String(orderId), duplicated: false, granted, balances });
    });
  });
}
