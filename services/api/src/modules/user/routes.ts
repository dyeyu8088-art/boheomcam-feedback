import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode } from '@yanbian/protocol';
import { query } from '@yanbian/server-core';
import { ok, requireUser } from '../../server.js';
import { getBalances } from '@yanbian/wallet';

export function registerUserRoutes(app: FastifyInstance): void {
  /** 用户首页汇总：资料 + 资产 + 统计 */
  app.get('/api/v1/user/me', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const [u, p, balances, stats] = await Promise.all([
      query('SELECT id, phone, status, created_at, last_login_at FROM users WHERE id=$1', [uid]),
      query('SELECT nickname, avatar_id, gender, level, vip, exp FROM user_profiles WHERE user_id=$1', [uid]),
      getBalances(uid),
      query(
        `SELECT COUNT(*)::int AS rounds,
                COUNT(*) FILTER (WHERE score_change > 0)::int AS wins,
                COALESCE(SUM(score_change),0)::bigint AS total_score
         FROM game_results WHERE user_id=$1`,
        [uid],
      ),
    ]);
    if (!u.rowCount || !p.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, undefined, 404);
    const st = stats.rows[0]!;
    return ok({
      uid,
      phone: u.rows[0]!.phone ? String(u.rows[0]!.phone).replace(/^(\d{3})\d{4}/, '$1****') : null,
      nickname: p.rows[0]!.nickname,
      avatarId: p.rows[0]!.avatar_id,
      gender: p.rows[0]!.gender,
      level: p.rows[0]!.level,
      vip: p.rows[0]!.vip,
      exp: p.rows[0]!.exp,
      coins: balances.COIN,
      diamonds: balances.DIAMOND,
      points: balances.POINT,
      tickets: balances.TICKET,
      createdAt: u.rows[0]!.created_at,
      lastLoginAt: u.rows[0]!.last_login_at,
      totalRounds: st.rounds,
      wins: st.wins,
      winRate: st.rounds > 0 ? Math.round((st.wins / st.rounds) * 1000) / 10 : 0,
    });
  });

  app.post('/api/v1/user/profile', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const body = req.body as { nickname?: string; avatarId?: number; gender?: number };
    if (body.nickname !== undefined) {
      const nick = body.nickname.trim();
      if (nick.length < 2 || nick.length > 12) throw new ApiError(ErrorCode.VALIDATION, '昵称需 2-12 个字符');
      if (!/^[一-龥가-힣A-Za-z0-9_]+$/.test(nick)) throw new ApiError(ErrorCode.VALIDATION, '昵称含非法字符');
      await query('UPDATE user_profiles SET nickname=$2, updated_at=now() WHERE user_id=$1', [uid, nick]);
    }
    if (body.avatarId !== undefined) {
      const av = Number(body.avatarId);
      if (!Number.isInteger(av) || av < 1 || av > 24) throw new ApiError(ErrorCode.VALIDATION, '头像无效');
      await query('UPDATE user_profiles SET avatar_id=$2, updated_at=now() WHERE user_id=$1', [uid, av]);
    }
    if (body.gender !== undefined) {
      const g = Number(body.gender);
      if (![0, 1, 2].includes(g)) throw new ApiError(ErrorCode.VALIDATION, '性别无效');
      await query('UPDATE user_profiles SET gender=$2, updated_at=now() WHERE user_id=$1', [uid, g]);
    }
    return ok();
  });

  /** 战绩查询：range=today|yesterday|7d|30d|all */
  app.get('/api/v1/user/records', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const q = req.query as { range?: string; gameId?: string; page?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const range = q.range ?? '7d';
    const cond: string[] = ['r.user_id = $1'];
    const params: unknown[] = [uid];
    if (range === 'today') cond.push(`r.created_at >= date_trunc('day', now())`);
    else if (range === 'yesterday') cond.push(`r.created_at >= date_trunc('day', now()) - interval '1 day' AND r.created_at < date_trunc('day', now())`);
    else if (range === '7d') cond.push(`r.created_at >= now() - interval '7 days'`);
    else if (range === '30d') cond.push(`r.created_at >= now() - interval '30 days'`);
    if (q.gameId) {
      params.push(q.gameId);
      cond.push(`r.game_id = $${params.length}`);
    }
    params.push(20, (page - 1) * 20);
    const rows = await query(
      `SELECT r.round_id, r.room_id, r.game_id, r.score_change, r.detail, r.created_at
       FROM game_results r WHERE ${cond.join(' AND ')}
       ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok({ page, items: rows.rows });
  });

  /** 单局详情 + 全部玩家 */
  app.get('/api/v1/user/records/:roundId', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const roundId = Number((req.params as { roundId: string }).roundId);
    if (!Number.isInteger(roundId)) throw new ApiError(ErrorCode.VALIDATION);
    const mine = await query('SELECT 1 FROM game_results WHERE round_id=$1 AND user_id=$2', [roundId, uid]);
    if (!mine.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '战绩不存在', 404);
    const [players, round] = await Promise.all([
      query(
        `SELECT gr.user_id, gr.seat, gr.score_change, gr.detail, p.nickname, p.avatar_id
         FROM game_results gr JOIN user_profiles p ON p.user_id = gr.user_id
         WHERE gr.round_id=$1 ORDER BY gr.seat`,
        [roundId],
      ),
      query('SELECT room_id, game_id, stage_id, rule_version, result_summary, started_at, ended_at FROM game_rounds WHERE round_id=$1', [roundId]),
    ]);
    return ok({ round: round.rows[0] ?? null, players: players.rows });
  });

  /** 回放事件流（脱敏：仅本人可见自己的私有事件） */
  app.get('/api/v1/user/records/:roundId/replay', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const roundId = Number((req.params as { roundId: string }).roundId);
    if (!Number.isInteger(roundId)) throw new ApiError(ErrorCode.VALIDATION);
    const mine = await query('SELECT seat FROM game_results WHERE round_id=$1 AND user_id=$2', [roundId, uid]);
    if (!mine.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '战绩不存在', 404);
    const mySeat = mine.rows[0]!.seat as number;
    const actions = await query(
      'SELECT seq, actor_seat, action, payload FROM game_actions WHERE round_id=$1 ORDER BY seq',
      [roundId],
    );
    // 对局结束后回放对本人开放全量（他人手牌在 roundEnd 已公开属行业惯例）；进行中的局不可回放
    const ended = await query('SELECT ended_at FROM game_rounds WHERE round_id=$1', [roundId]);
    if (!ended.rowCount || !ended.rows[0]!.ended_at) throw new ApiError(ErrorCode.GAME_NOT_RUNNING, '对局未结束');
    return ok({ mySeat, events: actions.rows });
  });

  app.get('/api/v1/user/devices', { preHandler: requireUser }, async (req) => {
    const r = await query(
      'SELECT device_id, device_type, os_version, app_version, first_seen_at, last_seen_at FROM user_devices WHERE user_id=$1 ORDER BY last_seen_at DESC LIMIT 20',
      [req.authedUser!.uid],
    );
    return ok({ items: r.rows });
  });
}
