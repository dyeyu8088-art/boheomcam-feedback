/**
 * 客服工单（support-service）：大厅「客服」入口的真实后端。
 *  玩家：创建工单 / 列表 / 详情（往来消息）/ 追加留言 / 关闭
 *  后台：按状态分页 / 详情 / 回复 / 关闭 —— 每个写操作记录 audit_logs，权限点 support.manage
 * 工单与消息只追加不删除（可追溯）；用户侧限频：每小时最多 5 个新工单、每分钟 10 条留言。
 */
import type { FastifyInstance } from 'fastify';
import { ApiError, ErrorCode } from '@yanbian/protocol';
import { query, withTx } from '@yanbian/server-core';
import { ok, requireUser, userRateLimit } from '../../server.js';
import { audit, need, requireAdmin } from '../admin/routes.js';

const CATEGORIES = new Set(['account', 'coins', 'game', 'bug', 'suggest', 'other']);
const SUBJECT_MAX = 60;
const BODY_MAX = 2000;
const OPEN_LIMIT = 5;

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

async function ticketWithMessages(id: number, userId?: number): Promise<Record<string, unknown>> {
  const t = await query(
    `SELECT t.id, t.user_id, t.category, t.subject, t.status, t.last_reply_by, t.last_reply_at, t.closed_at, t.closed_by, t.created_at,
            p.nickname
       FROM support_tickets t LEFT JOIN user_profiles p ON p.user_id = t.user_id
      WHERE t.id=$1 ${userId ? 'AND t.user_id=$2' : ''}`,
    userId ? [id, userId] : [id],
  );
  if (!t.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '工单不存在', 404);
  const m = await query(`SELECT id, sender, body, created_at FROM support_messages WHERE ticket_id=$1 ORDER BY id`, [id]);
  return { ...t.rows[0], messages: m.rows };
}

export function registerSupportRoutes(app: FastifyInstance): void {
  app.get('/api/v1/support/tickets', { preHandler: requireUser }, async (req) => {
    const r = await query(
      `SELECT id, category, subject, status, last_reply_by, last_reply_at, created_at
         FROM support_tickets WHERE user_id=$1 ORDER BY id DESC LIMIT 50`,
      [req.authedUser!.uid],
    );
    return ok({ items: r.rows });
  });

  app.post('/api/v1/support/tickets', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    await userRateLimit(req, 'support.create', OPEN_LIMIT, 3600);
    const b = req.body as { category?: string; subject?: string; body?: string };
    const category = CATEGORIES.has(b.category ?? '') ? b.category! : 'other';
    const subject = cleanText(b.subject, SUBJECT_MAX);
    const body = typeof b.body === 'string' ? b.body.trim().slice(0, BODY_MAX) : '';
    if (subject.length < 2 || body.length < 2) throw new ApiError(ErrorCode.VALIDATION, '请填写标题与内容');
    const open = await query(`SELECT count(*)::int AS n FROM support_tickets WHERE user_id=$1 AND status<>'closed'`, [uid]);
    if ((open.rows[0]?.n ?? 0) >= OPEN_LIMIT) throw new ApiError(ErrorCode.INVALID_ACTION, '未关闭的工单过多，请等待客服处理');
    const id = await withTx(async (c) => {
      const t = await c.query(
        `INSERT INTO support_tickets (user_id, category, subject) VALUES ($1,$2,$3) RETURNING id`,
        [uid, category, subject],
      );
      const ticketId = Number(t.rows[0]!.id);
      await c.query(`INSERT INTO support_messages (ticket_id, sender, body) VALUES ($1,'user',$2)`, [ticketId, body]);
      return ticketId;
    });
    return ok({ ticketId: id });
  });

  app.get('/api/v1/support/tickets/:id', { preHandler: requireUser }, async (req) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new ApiError(ErrorCode.VALIDATION);
    return ok(await ticketWithMessages(id, req.authedUser!.uid));
  });

  app.post('/api/v1/support/tickets/:id/messages', { preHandler: requireUser }, async (req) => {
    const uid = req.authedUser!.uid;
    await userRateLimit(req, 'support.reply', 10, 60);
    const id = Number((req.params as { id: string }).id);
    const body = typeof (req.body as { body?: string }).body === 'string' ? (req.body as { body: string }).body.trim().slice(0, BODY_MAX) : '';
    if (!Number.isInteger(id) || body.length < 1) throw new ApiError(ErrorCode.VALIDATION);
    const t = await query(`SELECT status FROM support_tickets WHERE id=$1 AND user_id=$2`, [id, uid]);
    if (!t.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '工单不存在', 404);
    if (t.rows[0]!.status === 'closed') throw new ApiError(ErrorCode.INVALID_ACTION, '工单已关闭');
    await withTx(async (c) => {
      await c.query(`INSERT INTO support_messages (ticket_id, sender, body) VALUES ($1,'user',$2)`, [id, body]);
      await c.query(`UPDATE support_tickets SET status='open', last_reply_by='user', last_reply_at=now() WHERE id=$1`, [id]);
    });
    return ok();
  });

  app.post('/api/v1/support/tickets/:id/close', { preHandler: requireUser }, async (req) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new ApiError(ErrorCode.VALIDATION);
    const r = await query(
      `UPDATE support_tickets SET status='closed', closed_at=now(), closed_by='user' WHERE id=$1 AND user_id=$2 AND status<>'closed'`,
      [id, req.authedUser!.uid],
    );
    if (!r.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '工单不存在或已关闭', 404);
    return ok();
  });
}

export function registerSupportAdminRoutes(app: FastifyInstance): void {
  app.get('/api/admin/v1/support/tickets', { preHandler: requireAdmin }, async (req) => {
    need(req, 'support.manage');
    const q = req.query as { status?: string; page?: string; uid?: string };
    const page = Math.max(1, Number(q.page ?? 1) || 1);
    const size = 30;
    const cond: string[] = ['1=1'];
    const params: unknown[] = [];
    if (q.status && ['open', 'answered', 'closed'].includes(q.status)) {
      params.push(q.status);
      cond.push(`t.status=$${params.length}`);
    }
    if (q.uid && Number.isInteger(Number(q.uid))) {
      params.push(Number(q.uid));
      cond.push(`t.user_id=$${params.length}`);
    }
    params.push(size, (page - 1) * size);
    const r = await query(
      `SELECT t.id, t.user_id, t.category, t.subject, t.status, t.last_reply_by, t.last_reply_at, t.created_at, p.nickname,
              count(*) OVER() AS total
         FROM support_tickets t LEFT JOIN user_profiles p ON p.user_id=t.user_id
        WHERE ${cond.join(' AND ')}
        ORDER BY (t.status='open') DESC, t.last_reply_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = Number(r.rows[0]?.total ?? 0);
    return ok({ items: r.rows.map(({ total: _t, ...row }) => row), total, page, size });
  });

  app.get('/api/admin/v1/support/tickets/:id', { preHandler: requireAdmin }, async (req) => {
    need(req, 'support.manage');
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new ApiError(ErrorCode.VALIDATION);
    return ok(await ticketWithMessages(id));
  });

  app.post('/api/admin/v1/support/tickets/:id/reply', { preHandler: requireAdmin }, async (req) => {
    need(req, 'support.manage');
    const id = Number((req.params as { id: string }).id);
    const body = typeof (req.body as { body?: string }).body === 'string' ? (req.body as { body: string }).body.trim().slice(0, BODY_MAX) : '';
    if (!Number.isInteger(id) || body.length < 1) throw new ApiError(ErrorCode.VALIDATION, '回复内容不能为空');
    const t = await query(`SELECT status FROM support_tickets WHERE id=$1`, [id]);
    if (!t.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '工单不存在', 404);
    await withTx(async (c) => {
      await c.query(`INSERT INTO support_messages (ticket_id, sender, admin_id, body) VALUES ($1,'admin',$2,$3)`, [id, req.adminId, body]);
      await c.query(`UPDATE support_tickets SET status='answered', last_reply_by='admin', last_reply_at=now() WHERE id=$1`, [id]);
    });
    await audit(req, 'support.reply', `ticket:${id}`, { status: t.rows[0]!.status }, { status: 'answered', body });
    return ok();
  });

  app.post('/api/admin/v1/support/tickets/:id/close', { preHandler: requireAdmin }, async (req) => {
    need(req, 'support.manage');
    const id = Number((req.params as { id: string }).id);
    const reason = cleanText((req.body as { reason?: string } | undefined)?.reason, 200);
    if (!Number.isInteger(id)) throw new ApiError(ErrorCode.VALIDATION);
    const t = await query(`SELECT status FROM support_tickets WHERE id=$1`, [id]);
    if (!t.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '工单不存在', 404);
    if (t.rows[0]!.status === 'closed') throw new ApiError(ErrorCode.INVALID_ACTION, '工单已关闭');
    await query(`UPDATE support_tickets SET status='closed', closed_at=now(), closed_by='admin' WHERE id=$1`, [id]);
    await audit(req, 'support.close', `ticket:${id}`, { status: t.rows[0]!.status }, { status: 'closed' }, reason || undefined);
    return ok();
  });
}
