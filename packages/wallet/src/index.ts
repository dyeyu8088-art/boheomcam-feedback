/**
 * wallet-service：账本唯一写入方。
 * 不变式：行锁扣款 / CHECK(balance>=0) / 幂等键唯一 / 借贷双录和为零 / 结算单 (round_id, settle_type) 唯一。
 */
import type { PoolClient } from 'pg';
import { ApiError, ErrorCode, type Currency } from '@yanbian/protocol';
import { getLogger, loadEnv, nextId, query, withTx } from '@yanbian/server-core';

const log = getLogger('wallet');

export const SYS = {
  ISSUER: 1,
  RAKE: 2,
  ACTIVITY: 3,
  ADJUST: 4,
  FISH_POOL: 5,
  SLOT_POOL: 6,
} as const;

export interface PostTxInput {
  idempotencyKey: string;
  userId: number;
  currency: Currency;
  type: string;
  /** 用户视角有符号金额 */
  amount: number;
  systemAccount: number;
  gameId?: string | null;
  roomId?: number | null;
  roundId?: number | null;
  referenceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PostedTx {
  transactionId: number;
  balanceAfter: number;
  duplicated: boolean;
}

export async function ensureAccounts(client: PoolClient, userId: number): Promise<void> {
  await client.query(
    `INSERT INTO wallet_accounts (user_id, currency, balance)
     VALUES ($1,'COIN',0),($1,'DIAMOND',0),($1,'POINT',0),($1,'TICKET',0)
     ON CONFLICT DO NOTHING`,
    [userId],
  );
}

/**
 * 在既有事务内过账。调用方负责加锁顺序（多用户结算按 userId 升序）。
 */
export async function postTransactionInTx(client: PoolClient, input: PostTxInput): Promise<PostedTx> {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new ApiError(ErrorCode.AMOUNT_INVALID, `金额不合法: ${input.amount}`);
  }
  // 幂等：先查（避免撞唯一约束毁掉外层事务）
  const dup = await client.query(
    'SELECT transaction_id, balance_after FROM wallet_transactions WHERE idempotency_key=$1',
    [input.idempotencyKey],
  );
  if (dup.rowCount) {
    return { transactionId: dup.rows[0]!.transaction_id, balanceAfter: dup.rows[0]!.balance_after, duplicated: true };
  }
  const acct = await client.query(
    'SELECT balance FROM wallet_accounts WHERE user_id=$1 AND currency=$2 FOR UPDATE',
    [input.userId, input.currency],
  );
  if (!acct.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, `钱包账户不存在 uid=${input.userId}`);
  const before = acct.rows[0]!.balance as number;
  const after = before + input.amount;
  if (after < 0) throw new ApiError(ErrorCode.INSUFFICIENT_BALANCE);

  const txId = nextId();
  const env = loadEnv();
  await client.query(
    `INSERT INTO wallet_transactions
      (transaction_id, idempotency_key, user_id, currency, type, amount, balance_before, balance_after,
       game_id, room_id, round_id, reference_id, server_id, description, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      txId,
      input.idempotencyKey,
      input.userId,
      input.currency,
      input.type,
      input.amount,
      before,
      after,
      input.gameId ?? null,
      input.roomId ?? null,
      input.roundId ?? null,
      input.referenceId ?? null,
      env.serverId,
      input.description ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  // 借贷双录：用户 + 系统对手账户
  await client.query(
    `INSERT INTO wallet_ledger_entries (transaction_id, account_id, currency, amount) VALUES
      ($1,$2,$3,$4),($1,$5,$3,$6)`,
    [txId, input.userId, input.currency, input.amount, input.systemAccount, -input.amount],
  );
  await client.query(
    `UPDATE wallet_accounts SET balance=$3, version=version+1, updated_at=now()
     WHERE user_id=$1 AND currency=$2`,
    [input.userId, input.currency, after],
  );
  return { transactionId: txId, balanceAfter: after, duplicated: false };
}

/** 独立事务过账（单笔） */
export async function postTransaction(input: PostTxInput): Promise<PostedTx> {
  return withTx((c) => postTransactionInTx(c, input));
}

export interface SettleEntry {
  userId: number;
  currency: Currency;
  amount: number; // 有符号
  type: string;
  systemAccount?: number;
}

export interface SettleInput {
  roundId: number;
  roomId?: number | null;
  gameId: string;
  settleType: string;
  entries: SettleEntry[];
  serverId: string;
  metadata?: Record<string, unknown>;
}

export interface SettleResult {
  settlementId: number;
  duplicated: boolean;
  balances: { userId: number; currency: Currency; balance: number }[];
}

/**
 * 对局结算：settlements 唯一约束物理防重复；同事务内按 userId 升序逐笔过账（防死锁）。
 * 任一失败整体回滚并标记 failed。
 */
export async function postSettlement(input: SettleInput): Promise<SettleResult> {
  const existing = await query(
    'SELECT settlement_id, status FROM settlements WHERE round_id=$1 AND settle_type=$2',
    [input.roundId, input.settleType],
  );
  if (existing.rowCount && existing.rows[0]!.status === 'posted') {
    const balances = await currentBalances(input.entries.map((e) => e.userId));
    return { settlementId: existing.rows[0]!.settlement_id, duplicated: true, balances };
  }

  const settlementId = nextId();
  try {
    const balances = await withTx(async (c) => {
      // 结算单占位（并发下第二个事务在此撞唯一约束回滚 → 走 duplicated 分支）
      await c.query(
        `INSERT INTO settlements (settlement_id, round_id, game_id, settle_type, payload, created_by_server, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
        [settlementId, input.roundId, input.gameId, input.settleType, JSON.stringify({ entries: input.entries, metadata: input.metadata ?? {} }), input.serverId],
      );
      const sorted = [...input.entries].sort((a, b) => a.userId - b.userId || (a.amount - b.amount));
      const out: { userId: number; currency: Currency; balance: number }[] = [];
      for (const e of sorted) {
        const posted = await postTransactionInTx(c, {
          idempotencyKey: `settle:${input.roundId}:${input.settleType}:${e.userId}:${e.type}`,
          userId: e.userId,
          currency: e.currency,
          type: e.type,
          amount: e.amount,
          systemAccount: e.systemAccount ?? SYS.ISSUER,
          gameId: input.gameId,
          roomId: input.roomId ?? null,
          roundId: input.roundId,
          metadata: input.metadata,
        });
        out.push({ userId: e.userId, currency: e.currency, balance: posted.balanceAfter });
      }
      await c.query(`UPDATE settlements SET status='posted', posted_at=now() WHERE settlement_id=$1`, [settlementId]);
      return out;
    });
    return { settlementId, duplicated: false, balances };
  } catch (err) {
    // 唯一约束冲突 → 并发重复结算：返回已入账结果
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('settlements_round_id_settle_type_key') || msg.includes('duplicate key')) {
      const again = await query(
        'SELECT settlement_id, status FROM settlements WHERE round_id=$1 AND settle_type=$2',
        [input.roundId, input.settleType],
      );
      if (again.rowCount) {
        const balances = await currentBalances(input.entries.map((e) => e.userId));
        return { settlementId: again.rows[0]!.settlement_id, duplicated: true, balances };
      }
    }
    // 真实失败：落一张 failed 单据以便追踪（不复用占位 id）
    log.error({ roundId: input.roundId, settleType: input.settleType, err: msg }, 'settlement failed');
    await query(
      `INSERT INTO settlements (settlement_id, round_id, game_id, settle_type, payload, created_by_server, status, error)
       VALUES ($1,$2,$3,$4,$5,$6,'failed',$7)
       ON CONFLICT (round_id, settle_type) DO NOTHING`,
      [nextId(), input.roundId, input.gameId, `${input.settleType}`, JSON.stringify({ entries: input.entries }), input.serverId, msg.slice(0, 500)],
    ).catch(() => undefined);
    throw err;
  }
}

async function currentBalances(userIds: number[]): Promise<{ userId: number; currency: Currency; balance: number }[]> {
  const uniq = [...new Set(userIds)];
  const r = await query(
    `SELECT user_id, currency, balance FROM wallet_accounts WHERE user_id = ANY($1)`,
    [uniq],
  );
  return r.rows.map((x) => ({ userId: x.user_id as number, currency: x.currency as Currency, balance: x.balance as number }));
}

export async function getBalances(userId: number): Promise<Record<Currency, number>> {
  const r = await query('SELECT currency, balance FROM wallet_accounts WHERE user_id=$1', [userId]);
  const out: Record<Currency, number> = { COIN: 0, DIAMOND: 0, POINT: 0, TICKET: 0 };
  for (const row of r.rows) out[row.currency as Currency] = row.balance as number;
  return out;
}

/** 管理员调账：调整记录 + 交易 + 审计（调用方须先过 RBAC 与二次确认） */
export async function adminAdjust(params: {
  adminId: number;
  userId: number;
  currency: Currency;
  amount: number;
  reason: string;
  adminIp: string;
  approveAdminId?: number | null;
}): Promise<{ adjustmentId: number; balanceAfter: number }> {
  if (!params.reason || params.reason.trim().length < 2) {
    throw new ApiError(ErrorCode.VALIDATION, '调账必须填写原因');
  }
  return withTx(async (c) => {
    const posted = await postTransactionInTx(c, {
      idempotencyKey: `adjust:${params.adminId}:${params.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      userId: params.userId,
      currency: params.currency,
      type: 'ADMIN_ADJUSTMENT',
      amount: params.amount,
      systemAccount: SYS.ADJUST,
      description: params.reason,
      metadata: { adminId: params.adminId },
    });
    const adjustmentId = nextId();
    await c.query(
      `INSERT INTO wallet_adjustments
        (adjustment_id, admin_id, user_id, currency, amount, reason, balance_before, balance_after, approve_admin_id, admin_ip, transaction_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        adjustmentId,
        params.adminId,
        params.userId,
        params.currency,
        params.amount,
        params.reason,
        posted.balanceAfter - params.amount,
        posted.balanceAfter,
        params.approveAdminId ?? null,
        params.adminIp,
        posted.transactionId,
      ],
    );
    return { adjustmentId, balanceAfter: posted.balanceAfter };
  });
}
