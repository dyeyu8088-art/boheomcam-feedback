/** activity-service：签到 / 任务（配置驱动，奖励统一走 wallet） */
import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode, type Currency } from '@yanbian/protocol';
import { query, withTx } from '@yanbian/server-core';
import { postTransactionInTx, SYS } from '@yanbian/wallet';
import { ok, requireUser } from '../../server.js';

interface SignReward {
  day: number;
  currency: Currency;
  amount: number;
}

async function signinConfig(): Promise<SignReward[]> {
  const r = await query(
    `SELECT config FROM activities WHERE type='sign_in' AND status='active' AND start_at<=now() AND end_at>=now() ORDER BY id DESC LIMIT 1`,
  );
  if (!r.rowCount) return [];
  return ((r.rows[0]!.config as { rewards?: SignReward[] }).rewards ?? []);
}

function periodKey(period: 'daily' | 'weekly', d = new Date()): string {
  if (period === 'daily') return d.toISOString().slice(0, 10);
  const year = d.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function registerActivityRoutes(app: FastifyInstance): void {
  app.get('/api/v1/activity/signin', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const rewards = await signinConfig();
    const today = new Date().toISOString().slice(0, 10);
    const recent = await query(
      `SELECT sign_date::text AS d, streak FROM signin_records WHERE user_id=$1 ORDER BY sign_date DESC LIMIT 1`,
      [uid],
    );
    const last = recent.rows[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = last ? (last.d === today ? last.streak : last.d === yesterday ? last.streak : 0) : 0;
    return ok({
      todaySigned: last?.d === today,
      streak,
      rewards: rewards.map((r) => ({ ...r, claimed: false })),
    });
  });

  app.post('/api/v1/activity/signin', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const rewards = await signinConfig();
    if (rewards.length === 0) throw new ApiError(ErrorCode.NOT_FOUND, '签到活动未开启');
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return withTx(async (c) => {
      const dup = await c.query('SELECT 1 FROM signin_records WHERE user_id=$1 AND sign_date=$2', [uid, today]);
      if (dup.rowCount) throw new ApiError(ErrorCode.DUPLICATE_TRANSACTION, '今日已签到');
      const prev = await c.query(
        'SELECT streak FROM signin_records WHERE user_id=$1 AND sign_date=$2',
        [uid, yesterday],
      );
      const streak = prev.rowCount ? Math.min((prev.rows[0]!.streak as number) + 1, rewards.length) : 1;
      const reward = rewards[(streak - 1) % rewards.length]!;
      await c.query(
        'INSERT INTO signin_records (user_id, sign_date, streak, reward) VALUES ($1,$2,$3,$4)',
        [uid, today, streak, JSON.stringify(reward)],
      );
      const posted = await postTransactionInTx(c, {
        idempotencyKey: `signin:${uid}:${today}`,
        userId: uid,
        currency: reward.currency,
        type: 'SIGNIN_REWARD',
        amount: reward.amount,
        systemAccount: SYS.ACTIVITY,
        description: `每日签到 第${streak}天`,
      });
      return ok({ streak, reward, balanceAfter: posted.balanceAfter });
    });
  });

  app.get('/api/v1/activity/tasks', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const tasks = await query(`SELECT task_id, name, name_ko, descr, period, metric, game_id, target, rewards, sort FROM tasks WHERE status='active' ORDER BY sort`);
    const keys = tasks.rows.map((t) => periodKey(t.period as 'daily' | 'weekly'));
    const prog = await query(
      `SELECT task_id, period_key, progress, claimed_at FROM task_progress WHERE user_id=$1 AND period_key = ANY($2)`,
      [uid, [...new Set(keys)]],
    );
    const progMap = new Map(prog.rows.map((p) => [`${p.task_id}:${p.period_key}`, p]));
    return ok({
      items: tasks.rows.map((t) => {
        const pk = periodKey(t.period as 'daily' | 'weekly');
        const p = progMap.get(`${t.task_id}:${pk}`);
        const progress = (p?.progress as number) ?? 0;
        return {
          taskId: t.task_id,
          name: t.name,
          nameKo: t.name_ko,
          desc: t.descr,
          period: t.period,
          target: t.target,
          progress: Math.min(progress, t.target as number),
          rewards: t.rewards,
          completed: progress >= (t.target as number),
          claimed: !!p?.claimed_at,
        };
      }),
    });
  });

  app.post('/api/v1/activity/tasks/:taskId/claim', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const taskId = (req.params as { taskId: string }).taskId;
    const t = await query('SELECT task_id, period, target, rewards FROM tasks WHERE task_id=$1 AND status=\'active\'', [taskId]);
    if (!t.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '任务不存在', 404);
    const task = t.rows[0]!;
    const pk = periodKey(task.period as 'daily' | 'weekly');
    return withTx(async (c) => {
      const p = await c.query(
        'SELECT progress, claimed_at FROM task_progress WHERE user_id=$1 AND task_id=$2 AND period_key=$3 FOR UPDATE',
        [uid, taskId, pk],
      );
      if (!p.rowCount || (p.rows[0]!.progress as number) < (task.target as number)) {
        throw new ApiError(ErrorCode.INVALID_ACTION, '任务未完成');
      }
      if (p.rows[0]!.claimed_at) throw new ApiError(ErrorCode.DUPLICATE_TRANSACTION, '奖励已领取');
      await c.query(
        'UPDATE task_progress SET claimed_at=now() WHERE user_id=$1 AND task_id=$2 AND period_key=$3',
        [uid, taskId, pk],
      );
      const rewards = task.rewards as { currency: Currency; amount: number }[];
      const balances: Record<string, number> = {};
      for (const r of rewards) {
        const posted = await postTransactionInTx(c, {
          idempotencyKey: `task:${uid}:${taskId}:${pk}:${r.currency}`,
          userId: uid,
          currency: r.currency,
          type: 'TASK_REWARD',
          amount: r.amount,
          systemAccount: SYS.ACTIVITY,
          description: `任务奖励 ${taskId}`,
        });
        balances[r.currency] = posted.balanceAfter;
      }
      return ok({ rewards, balances });
    });
  });
}

/** 任务进度上报（内部：由结算/游戏服务调用） */
export async function bumpTaskProgress(uid: number, metric: string, gameId: string | null, by = 1): Promise<void> {
  const tasks = await query(
    `SELECT task_id, period, game_id FROM tasks WHERE status='active' AND metric=$1`,
    [metric],
  );
  for (const t of tasks.rows) {
    if (t.game_id && t.game_id !== gameId) continue;
    const pk = periodKey(t.period as 'daily' | 'weekly');
    await query(
      `INSERT INTO task_progress (user_id, task_id, period_key, progress)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, task_id, period_key) DO UPDATE SET progress = task_progress.progress + $4, updated_at=now()`,
      [uid, t.task_id, pk, by],
    );
  }
}
