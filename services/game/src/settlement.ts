/**
 * settlement-service：对局落库 + 钱包结算 + 任务进度 + 榜单。
 * 机器人不产生钱包账目（真实玩家与系统发行账户对手记账）。
 */
import { getLogger, getRedis, loadEnv, query, withTx } from '@yanbian/server-core';
import { postSettlement } from '@yanbian/wallet';
import type { Room } from './room.js';

const log = getLogger('settlement');

export const GAME_VERSION = '1.0.0';

export async function persistRoundStart(room: Room, roundId: number, ruleSnapshot: unknown): Promise<void> {
  await query(
    `INSERT INTO game_rounds (round_id, room_id, game_id, stage_id, round_index, rule_snapshot, game_version, rule_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [roundId, room.roomId, room.gameCode, room.stage.stageId, room.currentRound, JSON.stringify(ruleSnapshot ?? {}), GAME_VERSION, room.ruleVersion],
  );
}

export interface PlayerRoundOutcome {
  uid: number;
  seat: number;
  scoreChange: number;
  coinChange: number;
  isBot: boolean;
  isWin: boolean;
  detail: Record<string, unknown>;
}

export async function persistRoundEnd(
  room: Room,
  roundId: number,
  events: { seq: number; type: string; seat: number; data: Record<string, unknown> }[],
  summary: Record<string, unknown>,
  outcomes: PlayerRoundOutcome[],
): Promise<{ balances: { userId: number; balance: number }[] }> {
  // 回放事件流批量落库
  await withTx(async (c) => {
    const values: string[] = [];
    const params: unknown[] = [roundId];
    let i = 2;
    for (const e of events) {
      values.push(`($1, $${i}, $${i + 1}, $${i + 2}, $${i + 3})`);
      params.push(e.seq, e.seat, e.type, JSON.stringify(e.data));
      i += 4;
    }
    if (values.length) {
      await c.query(`INSERT INTO game_actions (round_id, seq, actor_seat, action, payload) VALUES ${values.join(',')}`, params);
    }
    for (const o of outcomes) {
      if (o.isBot) continue;
      await c.query(
        `INSERT INTO game_results (round_id, room_id, game_id, user_id, seat, score_change, coin_change, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (round_id, user_id) DO NOTHING`,
        [roundId, room.roomId, room.gameCode, o.uid, o.seat, o.scoreChange, o.coinChange, JSON.stringify(o.detail)],
      );
    }
    await c.query(`UPDATE game_rounds SET ended_at=now(), result_summary=$2 WHERE round_id=$1`, [roundId, JSON.stringify(summary)]);
  });

  // 钱包结算（真实玩家）
  const entries = outcomes
    .filter((o) => !o.isBot && o.coinChange !== 0)
    .map((o) => ({
      userId: o.uid,
      currency: 'COIN' as const,
      amount: o.coinChange,
      type: o.coinChange > 0 ? 'GAME_WIN' : 'GAME_LOSS',
    }));
  let balances: { userId: number; balance: number }[] = [];
  if (entries.length) {
    const result = await postSettlement({
      roundId,
      roomId: room.roomId,
      gameId: room.gameCode,
      settleType: 'round',
      entries,
      serverId: loadEnv().serverId,
      metadata: { stageId: room.stage.stageId },
    });
    balances = result.balances.filter((b) => b.currency === 'COIN').map((b) => ({ userId: b.userId, balance: b.balance }));
  }

  // 任务进度 + 日榜（尽力而为，失败不影响结算）
  const day = new Date().toISOString().slice(0, 10);
  const redis = getRedis();
  for (const o of outcomes) {
    if (o.isBot) continue;
    await bumpTask(o.uid, 'play_rounds', room.gameCode);
    if (o.isWin) {
      await bumpTask(o.uid, 'win_rounds', room.gameCode);
      await redis.zincrby(`rank:wins:${day}`, 1, String(o.uid)).catch(() => undefined);
      await redis.expire(`rank:wins:${day}`, 172800).catch(() => undefined);
    }
  }
  log.info({ roundId, roomId: room.roomId, game: room.gameCode }, 'round settled');
  return { balances };
}

/** 任务进度（与 api 服务同一 DB，直接写 task_progress） */
export async function bumpTask(uid: number, metric: string, gameId: string | null, by = 1): Promise<void> {
  const tasks = await query(`SELECT task_id, period, game_id FROM tasks WHERE status='active' AND metric=$1`, [metric]);
  for (const t of tasks.rows) {
    if (t.game_id && t.game_id !== gameId) continue;
    const period = t.period as 'daily' | 'weekly';
    const d = new Date();
    let pk: string;
    if (period === 'daily') pk = d.toISOString().slice(0, 10);
    else {
      const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7);
      pk = `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    await query(
      `INSERT INTO task_progress (user_id, task_id, period_key, progress) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, task_id, period_key) DO UPDATE SET progress = task_progress.progress + $4, updated_at=now()`,
      [uid, t.task_id, pk, by],
    ).catch(() => undefined);
  }
}
