/**
 * tournament-service：赛事（纯荣誉 + 虚拟奖励）。
 * - 报名 → 分数由游戏服结算时按 metric 累加（settlement.bumpTournament）
 * - 调度：每 60s 推进状态（scheduled→running→settled），结算时按名次发邮件附件奖励，并自动生成下一期
 */
import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode, type Currency } from '@yanbian/protocol';
import { getLogger, query, withTx } from '@yanbian/server-core';
import { ok, requireUser } from '../../server.js';
import { sendSystemMail } from '../social/routes.js';

const log = getLogger('tournament');

interface RewardTier {
  rankFrom: number;
  rankTo: number;
  currency: Currency;
  amount: number;
}

export function registerTournamentRoutes(app: FastifyInstance): void {
  app.get('/api/v1/tournaments', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const list = await query(
      `SELECT t.*, (SELECT count(*)::int FROM tournament_entries e WHERE e.tournament_id=t.id) AS participants,
              me.score AS my_score, me.rank AS my_rank, me.joined_at AS my_joined
       FROM tournaments t LEFT JOIN tournament_entries me ON me.tournament_id=t.id AND me.user_id=$1
       WHERE t.status IN ('running','scheduled') OR (t.status='settled' AND t.ends_at > now() - interval '7 days')
       ORDER BY CASE t.status WHEN 'running' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END, t.ends_at`,
      [uid],
    );
    const items = [] as Record<string, unknown>[];
    for (const t of list.rows) {
      const top = await query(
        `SELECT e.user_id, e.score, e.rank, p.nickname, p.avatar_id
         FROM tournament_entries e JOIN user_profiles p ON p.user_id=e.user_id
         WHERE e.tournament_id=$1 ORDER BY e.score DESC, e.joined_at ASC LIMIT 10`,
        [t.id],
      );
      let myRank: number | null = t.my_rank ?? null;
      if (myRank == null && t.my_joined) {
        const r = await query(`SELECT count(*)::int + 1 AS r FROM tournament_entries WHERE tournament_id=$1 AND (score > $2 OR (score = $2 AND joined_at < $3))`, [t.id, t.my_score ?? 0, t.my_joined]);
        myRank = Number(r.rows[0]!.r);
      }
      items.push({
        id: String(t.id),
        gameId: t.game_id,
        name: t.name,
        nameKo: t.name_ko,
        metric: t.metric,
        startsAt: new Date(t.starts_at).getTime(),
        endsAt: new Date(t.ends_at).getTime(),
        rewards: t.rewards,
        status: t.status,
        participants: Number(t.participants),
        joined: !!t.my_joined,
        myScore: t.my_score == null ? null : Number(t.my_score),
        myRank,
        top: top.rows.map((r, i) => ({ uid: Number(r.user_id), nickname: r.nickname, avatarId: r.avatar_id, score: Number(r.score), rank: r.rank ?? i + 1 })),
      });
    }
    return ok({ items });
  });

  app.post('/api/v1/tournaments/:id/join', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) throw new ApiError(ErrorCode.BAD_REQUEST, '参数错误');
    return withTx(async (c) => {
      const t = await c.query(`SELECT status, starts_at, ends_at FROM tournaments WHERE id=$1 FOR SHARE`, [id]);
      if (!t.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '赛事不存在');
      const row = t.rows[0]!;
      if (row.status !== 'running' || new Date(row.ends_at).getTime() < Date.now()) throw new ApiError(ErrorCode.BAD_REQUEST, '赛事未开放报名');
      const ins = await c.query(`INSERT INTO tournament_entries (tournament_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING joined_at`, [id, uid]);
      return ok({ joined: true, duplicated: ins.rowCount === 0 });
    });
  });
}

/** 推进赛事状态 + 结算发奖 + 生成下一期。api 服务启动后每 60s 调用一次。 */
export async function tournamentTick(): Promise<void> {
  await query(`UPDATE tournaments SET status='running' WHERE status='scheduled' AND starts_at <= now()`);
  const ended = await query(`SELECT * FROM tournaments WHERE status='running' AND ends_at <= now() ORDER BY ends_at LIMIT 20`);
  for (const t of ended.rows) {
    await withTx(async (c) => {
      const lock = await c.query(`SELECT status FROM tournaments WHERE id=$1 FOR UPDATE`, [t.id]);
      if (lock.rows[0]?.status !== 'running') return;
      const entries = await c.query(`SELECT user_id, score FROM tournament_entries WHERE tournament_id=$1 ORDER BY score DESC, joined_at ASC`, [t.id]);
      const rewards = (t.rewards ?? []) as RewardTier[];
      let rank = 0;
      for (const e of entries.rows) {
        rank += 1;
        const tier = rewards.find((r) => rank >= r.rankFrom && rank <= r.rankTo);
        let mailId: number | null = null;
        if (tier && Number(e.score) > 0) {
          mailId = await sendSystemMail(Number(e.user_id), `${t.name} 第 ${rank} 名奖励`, `恭喜你在「${t.name}」中获得第 ${rank} 名（成绩 ${e.score}），奖励已随信附上。`, [
            { currency: tier.currency, amount: tier.amount },
          ]);
        }
        await c.query(`UPDATE tournament_entries SET rank=$3, reward_mail_id=$4 WHERE tournament_id=$1 AND user_id=$2`, [t.id, e.user_id, rank, mailId]);
      }
      await c.query(`UPDATE tournaments SET status='settled', settled_at=now() WHERE id=$1`, [t.id]);
      // 下一期：同名同规则，周期与上期一致
      const durMs = new Date(t.ends_at).getTime() - new Date(t.starts_at).getTime();
      await c.query(
        `INSERT INTO tournaments (game_id, name, name_ko, metric, starts_at, ends_at, rewards, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'running')`,
        [t.game_id, t.name, t.name_ko, t.metric, new Date(t.ends_at), new Date(new Date(t.ends_at).getTime() + durMs), JSON.stringify(rewards)],
      );
      log.info({ id: t.id, name: t.name, entries: entries.rowCount }, 'tournament settled');
    }).catch((e: Error) => log.error({ id: t.id, err: e.message }, 'tournament settle failed'));
  }
}

export function startTournamentScheduler(): () => void {
  const timer = setInterval(() => void tournamentTick().catch((e: Error) => log.error({ err: e.message }, 'tick failed')), 60_000);
  void tournamentTick().catch(() => undefined);
  return () => clearInterval(timer);
}
