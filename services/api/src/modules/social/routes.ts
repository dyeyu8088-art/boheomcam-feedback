/** friend-service + mail-service + 公告 + 排行榜 */
import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode, type Currency } from '@yanbian/protocol';
import { getRedis, nextId, query, withTx } from '@yanbian/server-core';
import { postTransactionInTx, SYS } from '@yanbian/wallet';
import { ok, requireUser, userRateLimit } from '../../server.js';

export function registerSocialRoutes(app: FastifyInstance): void {
  // ── 好友 ─────────────────────────────────────────────
  app.get('/api/v1/friends', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const r = await query(
      `SELECT f.friend_id AS uid, p.nickname, p.avatar_id, p.vip
       FROM friends f JOIN user_profiles p ON p.user_id=f.friend_id
       WHERE f.user_id=$1 ORDER BY f.created_at DESC LIMIT 200`,
      [uid],
    );
    const redis = getRedis();
    const items = await Promise.all(
      r.rows.map(async (row) => {
        const [online, playing] = await Promise.all([
          redis.exists(`online:${row.uid}`),
          redis.get(`playing:${row.uid}`),
        ]);
        return { uid: row.uid, nickname: row.nickname, avatarId: row.avatar_id, vip: row.vip, online: online === 1, playing };
      }),
    );
    return ok({ items });
  });

  app.get('/api/v1/friends/search', { preHandler: requireUser }, async (req) => {
    await userRateLimit(req, 'fsearch', 20, 60);
    const q = (req.query as { uid?: string }).uid ?? '';
    const target = Number(q);
    if (!Number.isInteger(target)) throw new ApiError(ErrorCode.VALIDATION, '请输入数字 UID');
    const r = await query(
      `SELECT u.id AS uid, p.nickname, p.avatar_id, p.vip FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1 AND u.status='normal'`,
      [target],
    );
    return ok({ found: r.rowCount ? r.rows[0] : null });
  });

  app.post('/api/v1/friends/request', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    await userRateLimit(req, 'freq', 10, 300);
    const body = req.body as { toUid?: number; message?: string };
    const to = Number(body.toUid);
    if (!Number.isInteger(to) || to === uid) throw new ApiError(ErrorCode.VALIDATION);
    const exists = await query('SELECT 1 FROM users WHERE id=$1 AND status=\'normal\'', [to]);
    if (!exists.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '用户不存在', 404);
    const already = await query('SELECT 1 FROM friends WHERE user_id=$1 AND friend_id=$2', [uid, to]);
    if (already.rowCount) throw new ApiError(ErrorCode.INVALID_ACTION, '已是好友');
    await query(
      `INSERT INTO friend_requests (from_user, to_user, message, status) VALUES ($1,$2,$3,'pending')
       ON CONFLICT (from_user, to_user, status) DO NOTHING`,
      [uid, to, (body.message ?? '').slice(0, 50)],
    );
    return ok();
  });

  app.get('/api/v1/friends/requests', { preHandler: requireUser }, async (req) => {
    const r = await query(
      `SELECT fr.id, fr.from_user AS uid, fr.message, fr.created_at, p.nickname, p.avatar_id
       FROM friend_requests fr JOIN user_profiles p ON p.user_id=fr.from_user
       WHERE fr.to_user=$1 AND fr.status='pending' ORDER BY fr.created_at DESC LIMIT 50`,
      [req.authedUser!.uid],
    );
    return ok({ items: r.rows });
  });

  app.post('/api/v1/friends/requests/:id', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const id = Number((req.params as { id: string }).id);
    const action = (req.body as { action?: string }).action;
    if (!['accept', 'reject'].includes(action ?? '')) throw new ApiError(ErrorCode.VALIDATION);
    await withTx(async (c) => {
      const r = await c.query(
        `UPDATE friend_requests SET status=$3, handled_at=now()
         WHERE id=$1 AND to_user=$2 AND status='pending' RETURNING from_user`,
        [id, uid, action === 'accept' ? 'accepted' : 'rejected'],
      );
      if (!r.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '申请不存在', 404);
      if (action === 'accept') {
        const from = r.rows[0]!.from_user as number;
        await c.query(
          `INSERT INTO friends (user_id, friend_id) VALUES ($1,$2),($2,$1) ON CONFLICT DO NOTHING`,
          [uid, from],
        );
      }
    });
    return ok();
  });

  app.delete('/api/v1/friends/:uid', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const target = Number((req.params as { uid: string }).uid);
    await query('DELETE FROM friends WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)', [uid, target]);
    return ok();
  });

  // ── 邮件 ─────────────────────────────────────────────
  app.get('/api/v1/mail', { preHandler: requireUser }, async (req) => {
    const r = await query(
      `SELECT mail_id, title, body, attachments, read_at, claimed_at, created_at
       FROM mail WHERE to_user=$1 AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC LIMIT 50`,
      [req.authedUser!.uid],
    );
    return ok({ items: r.rows });
  });

  app.post('/api/v1/mail/:mailId/read', { preHandler: requireUser }, async (req) => {
    await query('UPDATE mail SET read_at=COALESCE(read_at, now()) WHERE mail_id=$1 AND to_user=$2', [
      Number((req.params as { mailId: string }).mailId),
      req.authedUser!.uid,
    ]);
    return ok();
  });

  app.post('/api/v1/mail/:mailId/claim', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    const mailId = Number((req.params as { mailId: string }).mailId);
    return withTx(async (c) => {
      const r = await c.query(
        'SELECT attachments, claimed_at FROM mail WHERE mail_id=$1 AND to_user=$2 FOR UPDATE',
        [mailId, uid],
      );
      if (!r.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '邮件不存在', 404);
      if (r.rows[0]!.claimed_at) throw new ApiError(ErrorCode.DUPLICATE_TRANSACTION, '附件已领取');
      const attachments = r.rows[0]!.attachments as { currency: Currency; amount: number }[];
      if (!attachments.length) throw new ApiError(ErrorCode.INVALID_ACTION, '无附件');
      await c.query('UPDATE mail SET claimed_at=now(), read_at=COALESCE(read_at, now()) WHERE mail_id=$1', [mailId]);
      const balances: Record<string, number> = {};
      for (const a of attachments) {
        const posted = await postTransactionInTx(c, {
          idempotencyKey: `mail:${mailId}:${uid}:${a.currency}`,
          userId: uid,
          currency: a.currency,
          type: 'MAIL_REWARD',
          amount: a.amount,
          systemAccount: SYS.ACTIVITY,
          description: `邮件附件 #${mailId}`,
        });
        balances[a.currency] = posted.balanceAfter;
      }
      return ok({ balances });
    });
  });

  // ── 公告 ─────────────────────────────────────────────
  app.get('/api/v1/announcements', async () => {
    const r = await query(
      `SELECT id, title, title_ko, body, body_ko, sort, start_at, end_at
       FROM announcements WHERE status='active' AND start_at<=now() AND end_at>=now()
       ORDER BY sort, id DESC LIMIT 20`,
    );
    return ok({ items: r.rows });
  });

  // ── 排行榜（Redis 实时 + 每日落库由任务处理） ─────────
  app.get('/api/v1/rankings/:board', { preHandler: requireUser }, async (req) => {
    const board = (req.params as { board: string }).board;
    if (!['coins', 'wins_daily', 'fish_daily'].includes(board)) throw new ApiError(ErrorCode.VALIDATION);
    if (board === 'coins') {
      const r = await query(
        `SELECT w.user_id AS uid, w.balance AS value, p.nickname, p.avatar_id, p.vip
         FROM wallet_accounts w JOIN user_profiles p ON p.user_id=w.user_id
         WHERE w.currency='COIN' AND w.user_id > 100 ORDER BY w.balance DESC LIMIT 50`,
      );
      return ok({ items: r.rows.map((x, i) => ({ rank: i + 1, ...x })) });
    }
    const key = board === 'wins_daily' ? `rank:wins:${new Date().toISOString().slice(0, 10)}` : `rank:fish:${new Date().toISOString().slice(0, 10)}`;
    const raw = await getRedis().zrevrange(key, 0, 49, 'WITHSCORES');
    const items: { rank: number; uid: number; value: number; nickname?: string; avatar_id?: number; vip?: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      items.push({ rank: i / 2 + 1, uid: Number(raw[i]), value: Number(raw[i + 1]) });
    }
    if (items.length) {
      const profiles = await query('SELECT user_id, nickname, avatar_id, vip FROM user_profiles WHERE user_id = ANY($1)', [items.map((x) => x.uid)]);
      const map = new Map(profiles.rows.map((p) => [p.user_id, p]));
      for (const it of items) {
        const p = map.get(it.uid);
        if (p) {
          it.nickname = p.nickname;
          it.avatar_id = p.avatar_id;
          it.vip = p.vip;
        }
      }
    }
    return ok({ items });
  });
}

/** 系统发信（内部使用：活动奖励、风控通知等） */
export async function sendSystemMail(toUser: number, title: string, body: string, attachments: { currency: Currency; amount: number }[] = []): Promise<number> {
  const mailId = nextId();
  await query(
    `INSERT INTO mail (mail_id, to_user, title, body, attachments, expires_at)
     VALUES ($1,$2,$3,$4,$5, now() + interval '30 days')`,
    [mailId, toUser, title, body, JSON.stringify(attachments)],
  );
  return mailId;
}
