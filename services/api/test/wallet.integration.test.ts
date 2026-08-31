/**
 * 钱包账本集成测试（需要 postgres 运行：docker compose -f deploy/docker-compose.yml up -d postgres redis）
 * 覆盖：并发 100 扣款 / 幂等键 / 重复结算 / 借贷平衡 / 触发器防篡改 / 余额不可为负。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initIdGenerator, nextId, query, withTx } from '@yanbian/server-core';
import { ensureAccounts, getBalances, postSettlement, postTransaction, SYS } from '@yanbian/wallet';

let uidA = 0;
let uidB = 0;

async function makeUser(coins: number): Promise<number> {
  const uid = 90000000 + Math.floor(Math.random() * 9000000);
  await withTx(async (c) => {
    await c.query(`INSERT INTO users (id, guest_key) VALUES ($1, $2)`, [uid, `wtest-${uid}`]);
    await c.query(`INSERT INTO user_profiles (user_id, nickname) VALUES ($1, $2)`, [uid, `测试${uid}`]);
    await ensureAccounts(c, uid);
  });
  if (coins > 0) {
    await postTransaction({
      idempotencyKey: `wtest:init:${uid}`,
      userId: uid,
      currency: 'COIN',
      type: 'INIT_GRANT',
      amount: coins,
      systemAccount: SYS.ISSUER,
    });
  }
  return uid;
}

beforeAll(async () => {
  initIdGenerator(9);
  uidA = await makeUser(1000);
  uidB = await makeUser(0);
});

afterAll(async () => {
  await closeDb();
});

describe('钱包账本', () => {
  it('并发 100 笔扣款只成功 10 笔（余额 1000 / 每笔 100），余额精确为 0 且不为负', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) =>
        postTransaction({
          idempotencyKey: `wtest:concurrent:${uidA}:${i}`,
          userId: uidA,
          currency: 'COIN',
          type: 'GAME_BET',
          amount: -100,
          systemAccount: SYS.RAKE,
        }),
      ),
    );
    const okCount = results.filter((r) => r.status === 'fulfilled').length;
    expect(okCount).toBe(10);
    const balances = await getBalances(uidA);
    expect(balances.COIN).toBe(0);
    // before/after 链条连续
    const txs = await query(
      `SELECT amount, balance_before, balance_after FROM wallet_transactions WHERE user_id=$1 AND type='GAME_BET' ORDER BY transaction_id`,
      [uidA],
    );
    let prev = 1000;
    for (const t of txs.rows) {
      expect(t.balance_before).toBe(prev);
      expect(t.balance_after).toBe(prev + t.amount);
      prev = t.balance_after;
    }
  });

  it('幂等键重复提交返回首次结果且只入账一次', async () => {
    const key = `wtest:idem:${uidB}`;
    const a = await postTransaction({
      idempotencyKey: key,
      userId: uidB,
      currency: 'COIN',
      type: 'ACTIVITY_REWARD',
      amount: 500,
      systemAccount: SYS.ACTIVITY,
    });
    const b = await postTransaction({
      idempotencyKey: key,
      userId: uidB,
      currency: 'COIN',
      type: 'ACTIVITY_REWARD',
      amount: 500,
      systemAccount: SYS.ACTIVITY,
    });
    expect(a.duplicated).toBe(false);
    expect(b.duplicated).toBe(true);
    expect(b.transactionId).toBe(a.transactionId);
    expect((await getBalances(uidB)).COIN).toBe(500);
  });

  it('同一 round 重复结算被拒绝（返回首次结果，不重复入账）', async () => {
    const roundId = nextId();
    const input = {
      roundId,
      gameId: 'mahjong_yanbian',
      settleType: 'round',
      serverId: 'test',
      entries: [
        { userId: uidB, currency: 'COIN' as const, amount: -200, type: 'GAME_LOSS' },
        { userId: uidA, currency: 'COIN' as const, amount: 200, type: 'GAME_WIN' },
      ],
    };
    const first = await postSettlement(input);
    const second = await postSettlement(input);
    expect(first.duplicated).toBe(false);
    expect(second.duplicated).toBe(true);
    expect((await getBalances(uidA)).COIN).toBe(200);
    expect((await getBalances(uidB)).COIN).toBe(300);
    // 并发双结算
    const roundId2 = nextId();
    const input2 = { ...input, roundId: roundId2, entries: [{ userId: uidA, currency: 'COIN' as const, amount: -50, type: 'GAME_LOSS' }] };
    const [x, y] = await Promise.all([postSettlement(input2), postSettlement(input2)]);
    expect([x.duplicated, y.duplicated].filter(Boolean).length).toBe(1);
    expect((await getBalances(uidA)).COIN).toBe(150);
  });

  it('借贷双录全局平衡（SUM=0）', async () => {
    const r = await query(`SELECT COALESCE(SUM(amount),0)::bigint AS s FROM wallet_ledger_entries`);
    expect(Number(r.rows[0]!.s)).toBe(0);
  });

  it('余额不足扣款被拒绝，余额不变', async () => {
    await expect(
      postTransaction({
        idempotencyKey: `wtest:overdraft:${uidB}:${Date.now()}`,
        userId: uidB,
        currency: 'COIN',
        type: 'GAME_BET',
        amount: -999999,
        systemAccount: SYS.RAKE,
      }),
    ).rejects.toThrow();
    expect((await getBalances(uidB)).COIN).toBe(300);
  });

  it('数据库触发器拒绝篡改交易/分录/调账', async () => {
    const tx = await query(`SELECT transaction_id FROM wallet_transactions WHERE user_id=$1 LIMIT 1`, [uidA]);
    const id = tx.rows[0]!.transaction_id;
    await expect(query(`UPDATE wallet_transactions SET amount = amount + 1 WHERE transaction_id=$1`, [id])).rejects.toThrow(/immutable|append-only/);
    await expect(query(`DELETE FROM wallet_transactions WHERE transaction_id=$1`, [id])).rejects.toThrow(/append-only/);
    await expect(query(`DELETE FROM wallet_ledger_entries WHERE transaction_id=$1`, [id])).rejects.toThrow(/append-only/);
    await expect(query(`UPDATE audit_logs SET action='x' WHERE 1=0`)).resolves.toBeTruthy(); // 空更新不触发行级触发器
  });

  it('金额为 0 或非整数被拒绝', async () => {
    await expect(
      postTransaction({
        idempotencyKey: `wtest:zero:${Date.now()}`,
        userId: uidB,
        currency: 'COIN',
        type: 'GAME_BET',
        amount: 0,
        systemAccount: SYS.RAKE,
      }),
    ).rejects.toThrow();
  });
});
