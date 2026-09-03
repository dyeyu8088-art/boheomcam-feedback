/** admin-service：后台全部 API。每个写操作 → audit_logs；权限点到接口粒度。 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, ErrorCode, type Currency } from '@yanbian/protocol';
import {
  hashPassword,
  loadEnv,
  loginFailCount,
  loginFailReset,
  query,
  rateLimit,
  signJwt,
  verifyJwt,
  verifyPassword,
} from '@yanbian/server-core';
import { adminAdjust } from '@yanbian/wallet';
import { ok } from '../../server.js';
import { forceLogout } from '../auth/service.js';
import { sendSystemMail } from '../social/routes.js';

async function loadPerms(adminId: number): Promise<Set<string>> {
  const r = await query(
    `SELECT DISTINCT p.code FROM admin_roles ar
     JOIN role_permissions rp ON rp.role_id = ar.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ar.admin_id = $1`,
    [adminId],
  );
  return new Set(r.rows.map((x) => x.code as string));
}

async function requireAdmin(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(ErrorCode.ADMIN_AUTH_REQUIRED, undefined, 401);
  const payload = verifyJwt(header.slice(7), loadEnv().jwtSecret);
  if (!payload || payload.typ !== 'admin') throw new ApiError(ErrorCode.ADMIN_AUTH_REQUIRED, undefined, 401);
  req.adminId = payload.sub;
  req.adminPerms = await loadPerms(payload.sub);
}

function need(req: FastifyRequest, perm: string): void {
  if (!req.adminPerms?.has(perm)) throw new ApiError(ErrorCode.ADMIN_FORBIDDEN, `缺少权限 ${perm}`, 403);
}

async function audit(req: FastifyRequest, action: string, target: string, before: unknown, after: unknown, reason?: string): Promise<void> {
  await query(
    `INSERT INTO audit_logs (admin_id, action, target, before, after, reason, admin_ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [req.adminId, action, target, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after), reason ?? null, req.ip],
  );
}

export function registerAdminRoutes(app: FastifyInstance): void {
  // ── 登录 ─────────────────────────────────────────────
  app.post('/api/admin/v1/login', async (req) => {
    if (!(await rateLimit(`adminlogin:${req.ip}`, 10, 300))) throw new ApiError(ErrorCode.RATE_LIMITED, undefined, 429);
    const body = req.body as { username?: string; password?: string };
    const username = (body.username ?? '').trim();
    const fails = await loginFailCount(`admin:${username}`);
    if (fails > 5) throw new ApiError(ErrorCode.RATE_LIMITED, '尝试过多，请稍后再试', 429);
    const r = await query('SELECT id, password_hash, status, must_change_password, display_name FROM admins WHERE username=$1', [username]);
    const okLogin = r.rowCount && verifyPassword(body.password ?? '', r.rows[0]!.password_hash);
    await query('INSERT INTO admin_login_logs (admin_id, username, ip, result) VALUES ($1,$2,$3,$4)', [
      r.rows[0]?.id ?? null,
      username,
      req.ip,
      okLogin ? 'ok' : 'bad_credentials',
    ]);
    if (!okLogin) throw new ApiError(ErrorCode.BAD_CREDENTIALS, undefined, 401);
    const admin = r.rows[0]!;
    if (admin.status !== 'active') throw new ApiError(ErrorCode.ACCOUNT_BANNED, undefined, 403);
    await loginFailReset(`admin:${username}`);
    await query('UPDATE admins SET last_login_at=now(), last_login_ip=$2 WHERE id=$1', [admin.id, req.ip]);
    const env = loadEnv();
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: admin.id, typ: 'admin', iat: now, exp: now + 7200 }, env.jwtSecret);
    const perms = await loadPerms(admin.id);
    return ok({ token, adminId: admin.id, displayName: admin.display_name, mustChangePassword: admin.must_change_password, permissions: [...perms] });
  });

  app.post('/api/admin/v1/password', { preHandler: requireAdmin }, async (req) => {
    const body = req.body as { oldPassword?: string; newPassword?: string };
    if (!body.newPassword || body.newPassword.length < 10 || !/[A-Za-z]/.test(body.newPassword) || !/\d/.test(body.newPassword)) {
      throw new ApiError(ErrorCode.VALIDATION, '新密码需 ≥10 位且含字母与数字');
    }
    const r = await query('SELECT password_hash FROM admins WHERE id=$1', [req.adminId]);
    if (!verifyPassword(body.oldPassword ?? '', r.rows[0]!.password_hash)) throw new ApiError(ErrorCode.BAD_CREDENTIALS, undefined, 401);
    await query('UPDATE admins SET password_hash=$2, must_change_password=false WHERE id=$1', [req.adminId, hashPassword(body.newPassword)]);
    await audit(req, 'admin.password.change', `admin:${req.adminId}`, undefined, undefined);
    return ok();
  });

  // ── Dashboard ────────────────────────────────────────
  app.get('/api/admin/v1/dashboard', { preHandler: requireAdmin }, async (req) => {
    need(req, 'dashboard.view');
    const [users, dau, rounds, coins, online, risk, nodes, txDay] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today FROM users`),
      query(`SELECT COUNT(DISTINCT user_id)::int AS dau FROM user_login_logs WHERE created_at >= date_trunc('day', now())`),
      query(`SELECT game_id, COUNT(*)::int AS n FROM game_rounds WHERE started_at >= date_trunc('day', now()) GROUP BY game_id`),
      query(`SELECT
              COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND type IN ('GAME_WIN','ACTIVITY_REWARD','TASK_REWARD','SIGNIN_REWARD','MAIL_REWARD','INIT_GRANT')),0)::bigint AS produced,
              COALESCE(-SUM(amount) FILTER (WHERE amount < 0),0)::bigint AS consumed
             FROM wallet_transactions WHERE currency='COIN' AND created_at >= date_trunc('day', now())`),
      query(`SELECT 1`), // 在线数在 Redis
      query(`SELECT COUNT(*)::int AS open FROM risk_events WHERE status='open'`),
      query(`SELECT node_id, kind, roles, status, last_heartbeat_at FROM server_nodes ORDER BY node_id`),
      query(`SELECT date_trunc('hour', created_at) AS h, COUNT(*)::int AS n FROM wallet_transactions WHERE created_at >= now() - interval '24 hours' GROUP BY 1 ORDER BY 1`),
    ]);
    const { getRedis } = await import('@yanbian/server-core');
    const redis = getRedis();
    const totalOnline = Number((await redis.get('online:total')) ?? 0);
    const perGame: Record<string, number> = {};
    for (const g of ['mahjong_yanbian', 'hongshi', 'fishing', 'slot_fruit', 'roulette', 'stock_updown']) {
      perGame[g] = Number((await redis.get(`online:game:${g}`)) ?? 0);
    }
    void online;
    // 单人 / 共享回合类游戏（水果机 / 轮盘 / 股票）不走 game_rounds，单独统计今日回合与投入产出
    const arcade = await Promise.all([
      query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_bet),0)::bigint AS bet, COALESCE(SUM(total_win),0)::bigint AS payout FROM slot_rounds WHERE created_at >= date_trunc('day', now())`),
      query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_bet),0)::bigint AS bet, COALESCE(SUM(total_payout),0)::bigint AS payout FROM roulette_rounds WHERE opened_at >= date_trunc('day', now()) AND settled_at IS NOT NULL`),
      query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_bet),0)::bigint AS bet, COALESCE(SUM(total_payout),0)::bigint AS payout FROM stock_rounds WHERE opened_at >= date_trunc('day', now()) AND settled_at IS NOT NULL`),
    ]);
    const arcadeToday = {
      slot_fruit: arcade[0].rows[0],
      roulette: arcade[1].rows[0],
      stock_updown: arcade[2].rows[0],
    };
    return ok({
      arcadeToday,
      totalUsers: users.rows[0]!.total,
      todayNewUsers: users.rows[0]!.today,
      dau: dau.rows[0]!.dau,
      online: totalOnline,
      onlinePerGame: perGame,
      roundsToday: rounds.rows,
      coinProducedToday: coins.rows[0]!.produced,
      coinConsumedToday: coins.rows[0]!.consumed,
      openRiskEvents: risk.rows[0]!.open,
      serverNodes: nodes.rows,
      txPerHour: txDay.rows,
    });
  });

  // ── 用户管理 ─────────────────────────────────────────
  app.get('/api/admin/v1/users', { preHandler: requireAdmin }, async (req) => {
    need(req, 'user.view');
    const q = req.query as { search?: string; page?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const params: unknown[] = [];
    let where = '1=1';
    const s = (q.search ?? '').trim();
    if (s) {
      if (/^\d{6,}$/.test(s)) {
        params.push(Number(s));
        where = `u.id = $${params.length}`;
      } else if (/^1\d{10}$/.test(s)) {
        params.push(s);
        where = `u.phone = $${params.length}`;
      } else {
        params.push(`%${s}%`);
        where = `p.nickname ILIKE $${params.length}`;
      }
    }
    params.push(20, (page - 1) * 20);
    const r = await query(
      `SELECT u.id, u.phone, u.status, u.created_at, u.last_login_at, u.last_login_ip,
              p.nickname, p.avatar_id, p.level, p.vip,
              COALESCE(w.balance,0)::bigint AS coins
       FROM users u
       JOIN user_profiles p ON p.user_id=u.id
       LEFT JOIN wallet_accounts w ON w.user_id=u.id AND w.currency='COIN'
       WHERE ${where} ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok({ page, items: r.rows });
  });

  app.get('/api/admin/v1/users/:uid', { preHandler: requireAdmin }, async (req) => {
    need(req, 'user.view');
    const uid = Number((req.params as { uid: string }).uid);
    const [u, balances, devices, logins, results, adjustments] = await Promise.all([
      query(
        `SELECT u.*, p.nickname, p.avatar_id, p.gender, p.level, p.vip, p.exp FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1`,
        [uid],
      ),
      query('SELECT currency, balance FROM wallet_accounts WHERE user_id=$1', [uid]),
      query('SELECT device_id, device_type, os_version, app_version, last_seen_at FROM user_devices WHERE user_id=$1 ORDER BY last_seen_at DESC LIMIT 10', [uid]),
      query('SELECT login_type, ip, device_id, result, created_at FROM user_login_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [uid]),
      query('SELECT round_id, game_id, score_change, created_at FROM game_results WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [uid]),
      query('SELECT adjustment_id, admin_id, currency, amount, reason, balance_after, created_at FROM wallet_adjustments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [uid]),
    ]);
    if (!u.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, undefined, 404);
    const row = u.rows[0]! as Record<string, unknown>;
    delete row.password_hash;
    return ok({ user: row, balances: balances.rows, devices: devices.rows, logins: logins.rows, results: results.rows, adjustments: adjustments.rows });
  });

  app.post('/api/admin/v1/users/:uid/nickname', { preHandler: requireAdmin }, async (req) => {
    need(req, 'user.edit');
    const uid = Number((req.params as { uid: string }).uid);
    const nickname = ((req.body as { nickname?: string }).nickname ?? '').trim();
    if (nickname.length < 2 || nickname.length > 12) throw new ApiError(ErrorCode.VALIDATION);
    const before = await query('SELECT nickname FROM user_profiles WHERE user_id=$1', [uid]);
    await query('UPDATE user_profiles SET nickname=$2 WHERE user_id=$1', [uid, nickname]);
    await audit(req, 'user.nickname.edit', `user:${uid}`, before.rows[0], { nickname });
    return ok();
  });

  app.post('/api/admin/v1/users/:uid/ban', { preHandler: requireAdmin }, async (req) => {
    need(req, 'user.ban');
    const uid = Number((req.params as { uid: string }).uid);
    const body = req.body as { reason?: string; hours?: number; confirm?: boolean };
    if (!body.confirm) throw new ApiError(ErrorCode.ADMIN_CONFIRM_REQUIRED, '封禁需二次确认');
    if (!body.reason || body.reason.trim().length < 2) throw new ApiError(ErrorCode.VALIDATION, '必须填写封禁原因');
    const until = body.hours && body.hours > 0 ? new Date(Date.now() + body.hours * 3600000) : null;
    await query(`UPDATE users SET status='banned' WHERE id=$1`, [uid]);
    await query(
      `INSERT INTO bans (target_type, target, reason, until_at, operator_id) VALUES ('user',$1,$2,$3,$4)`,
      [String(uid), body.reason, until, req.adminId],
    );
    await forceLogout(uid);
    await audit(req, 'user.ban', `user:${uid}`, undefined, { until, reason: body.reason }, body.reason);
    return ok();
  });

  app.post('/api/admin/v1/users/:uid/unban', { preHandler: requireAdmin }, async (req) => {
    need(req, 'user.ban');
    const uid = Number((req.params as { uid: string }).uid);
    await query(`UPDATE users SET status='normal' WHERE id=$1`, [uid]);
    await query(`UPDATE bans SET lifted_at=now(), lifted_by=$2 WHERE target_type='user' AND target=$1 AND lifted_at IS NULL`, [String(uid), req.adminId]);
    await audit(req, 'user.unban', `user:${uid}`, undefined, undefined);
    return ok();
  });

  app.post('/api/admin/v1/users/:uid/kick', { preHandler: requireAdmin }, async (req) => {
    need(req, 'user.kick');
    const uid = Number((req.params as { uid: string }).uid);
    await forceLogout(uid);
    await audit(req, 'user.kick', `user:${uid}`, undefined, undefined);
    return ok();
  });

  /** 调账：二次确认 + 大额需 approve（此处按配置阈值） */
  app.post('/api/admin/v1/users/:uid/adjust', { preHandler: requireAdmin }, async (req) => {
    need(req, 'wallet.adjust');
    const uid = Number((req.params as { uid: string }).uid);
    const body = req.body as { currency?: Currency; amount?: number; reason?: string; confirm?: boolean };
    if (!body.confirm) throw new ApiError(ErrorCode.ADMIN_CONFIRM_REQUIRED, '调账需二次确认');
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000_000) throw new ApiError(ErrorCode.AMOUNT_INVALID);
    if (Math.abs(amount) > 1_000_000) need(req, 'wallet.adjust.approve'); // 大额需更高权限
    const r = await adminAdjust({
      adminId: req.adminId!,
      userId: uid,
      currency: (body.currency ?? 'COIN') as Currency,
      amount,
      reason: body.reason ?? '',
      adminIp: req.ip,
    });
    await audit(req, 'wallet.adjust', `user:${uid}`, undefined, { currency: body.currency, amount, balanceAfter: r.balanceAfter }, body.reason);
    return ok(r);
  });

  // ── 金币流水 / 结算 ───────────────────────────────────
  app.get('/api/admin/v1/wallet/transactions', { preHandler: requireAdmin }, async (req) => {
    need(req, 'wallet.view');
    const q = req.query as { uid?: string; type?: string; page?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const cond: string[] = ['1=1'];
    const params: unknown[] = [];
    if (q.uid) {
      params.push(Number(q.uid));
      cond.push(`user_id=$${params.length}`);
    }
    if (q.type) {
      params.push(q.type);
      cond.push(`type=$${params.length}`);
    }
    params.push(50, (page - 1) * 50);
    const r = await query(
      `SELECT transaction_id, user_id, currency, type, amount, balance_before, balance_after, game_id, round_id, server_id, description, created_at
       FROM wallet_transactions WHERE ${cond.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok({ page, items: r.rows });
  });

  app.get('/api/admin/v1/wallet/settlements', { preHandler: requireAdmin }, async (req) => {
    need(req, 'wallet.view');
    const page = Math.max(1, Number((req.query as { page?: string }).page ?? 1));
    const r = await query(
      `SELECT settlement_id, round_id, game_id, settle_type, status, error, created_at, posted_at
       FROM settlements ORDER BY created_at DESC LIMIT 50 OFFSET $1`,
      [(page - 1) * 50],
    );
    return ok({ page, items: r.rows });
  });

  // ── 房间 / 战绩 ──────────────────────────────────────
  app.get('/api/admin/v1/rooms', { preHandler: requireAdmin }, async (req) => {
    need(req, 'room.view');
    const r = await query(
      `SELECT r.room_id, r.room_no, r.game_id, r.stage_id, r.mode, r.state, r.server_node, r.created_at,
              COUNT(rp.id)::int AS players
       FROM rooms r LEFT JOIN room_players rp ON rp.room_id=r.room_id AND rp.left_at IS NULL
       WHERE r.state IN ('waiting','playing','settling')
       GROUP BY r.room_id ORDER BY r.created_at DESC LIMIT 100`,
    );
    return ok({ items: r.rows });
  });

  app.get('/api/admin/v1/rounds', { preHandler: requireAdmin }, async (req) => {
    need(req, 'record.view');
    const q = req.query as { gameId?: string; page?: string; uid?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    if (q.uid) {
      const params: unknown[] = [Number(q.uid), 50, (page - 1) * 50];
      const r = await query(
        `SELECT gr.round_id, gr.room_id, gr.game_id, gr.score_change, gr.created_at
         FROM game_results gr WHERE gr.user_id=$1 ORDER BY gr.created_at DESC LIMIT $2 OFFSET $3`,
        params,
      );
      return ok({ page, items: r.rows });
    }
    const cond = q.gameId ? 'WHERE game_id=$3' : '';
    const params: unknown[] = [50, (page - 1) * 50];
    if (q.gameId) params.push(q.gameId);
    const r = await query(
      `SELECT round_id, room_id, game_id, stage_id, rule_version, result_summary, started_at, ended_at
       FROM game_rounds ${cond} ORDER BY started_at DESC LIMIT $1 OFFSET $2`,
      params,
    );
    return ok({ page, items: r.rows });
  });

  // ── 街机类记录（水果机 Jackpot / 轮盘回合 / 股票回合）────
  app.get('/api/admin/v1/arcade/jackpots', { preHandler: requireAdmin }, async (req) => {
    need(req, 'record.view');
    const [pools, hits] = await Promise.all([
      query(`SELECT game_id, tier, pool, seed, contrib_bp, hit_chance_ppm, updated_at FROM slot_jackpots ORDER BY game_id, pool DESC`),
      query(`SELECT h.round_id, h.user_id, h.tier, h.amount, h.created_at FROM slot_jackpot_hits h ORDER BY h.created_at DESC LIMIT 50`),
    ]);
    return ok({ pools: pools.rows, hits: hits.rows });
  });

  app.get('/api/admin/v1/arcade/roulette/rounds', { preHandler: requireAdmin }, async (req) => {
    need(req, 'record.view');
    const q = req.query as { page?: string; roundId?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    if (q.roundId) {
      const bets = await query(
        `SELECT bet_id, user_id, bet_type, selection, amount, payout, created_at FROM roulette_bets WHERE round_id=$1 ORDER BY bet_id`,
        [Number(q.roundId)],
      );
      return ok({ items: bets.rows });
    }
    const r = await query(
      `SELECT round_id, table_id, opened_at, lock_at, result, rng_audit, total_bet, total_payout, settled_at, server_id,
              (SELECT COUNT(DISTINCT user_id)::int FROM roulette_bets b WHERE b.round_id = r.round_id) AS players
       FROM roulette_rounds r ORDER BY opened_at DESC LIMIT $1 OFFSET $2`,
      [50, (page - 1) * 50],
    );
    return ok({ page, items: r.rows });
  });

  app.get('/api/admin/v1/arcade/stock/rounds', { preHandler: requireAdmin }, async (req) => {
    need(req, 'record.view');
    const q = req.query as { page?: string; instrument?: string; roundId?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    if (q.roundId) {
      const bets = await query(
        `SELECT bet_id, user_id, bet_type, selection, amount, odds_bp, payout, created_at FROM stock_bets WHERE round_id=$1 ORDER BY bet_id`,
        [Number(q.roundId)],
      );
      return ok({ items: bets.rows });
    }
    const cond = q.instrument ? 'WHERE instrument=$3' : '';
    const params: unknown[] = [50, (page - 1) * 50];
    if (q.instrument) params.push(q.instrument);
    const r = await query(
      `SELECT round_id, instrument, opened_at, lock_at, settle_at, opening_price, settlement_price, direction, rng_audit, total_bet, total_payout, settled_at, server_id,
              (SELECT COUNT(DISTINCT user_id)::int FROM stock_bets b WHERE b.round_id = r.round_id) AS players
       FROM stock_rounds r ${cond} ORDER BY opened_at DESC LIMIT $1 OFFSET $2`,
      params,
    );
    return ok({ page, items: r.rows });
  });

  // ── 游戏与配置管理 ───────────────────────────────────
  app.get('/api/admin/v1/games', { preHandler: requireAdmin }, async (req) => {
    need(req, 'game.view');
    const r = await query('SELECT game_id, name, name_ko, status, min_client_version, sort FROM games ORDER BY sort');
    return ok({ items: r.rows });
  });

  app.post('/api/admin/v1/games/:gameId/status', { preHandler: requireAdmin }, async (req) => {
    need(req, 'game.maintain');
    const gameId = (req.params as { gameId: string }).gameId;
    const status = (req.body as { status?: string }).status;
    if (!['online', 'maintenance', 'offline'].includes(status ?? '')) throw new ApiError(ErrorCode.VALIDATION);
    const before = await query('SELECT status FROM games WHERE game_id=$1', [gameId]);
    if (!before.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, undefined, 404);
    await query('UPDATE games SET status=$2 WHERE game_id=$1', [gameId, status]);
    await audit(req, 'game.status', `game:${gameId}`, before.rows[0], { status });
    return ok();
  });

  app.get('/api/admin/v1/configs', { preHandler: requireAdmin }, async (req) => {
    need(req, 'config.view');
    const r = await query(
      `SELECT id, game_id, config_key, rule_version, status, created_at FROM game_configs ORDER BY game_id, config_key, id DESC LIMIT 200`,
    );
    return ok({ items: r.rows });
  });

  app.get('/api/admin/v1/configs/:id', { preHandler: requireAdmin }, async (req) => {
    need(req, 'config.view');
    const r = await query('SELECT * FROM game_configs WHERE id=$1', [Number((req.params as { id: string }).id)]);
    if (!r.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, undefined, 404);
    return ok(r.rows[0]);
  });

  /** 发布新配置版本（规则包/概率等）：写 game_configs + config_versions 留痕 */
  app.post('/api/admin/v1/configs', { preHandler: requireAdmin }, async (req) => {
    need(req, 'config.publish');
    const body = req.body as { gameId?: string; configKey?: string; ruleVersion?: string; config?: unknown; reason?: string; confirm?: boolean };
    if (!body.confirm) throw new ApiError(ErrorCode.ADMIN_CONFIRM_REQUIRED, '发布配置需二次确认');
    if (!body.gameId || !body.configKey || !body.ruleVersion || body.config === undefined) throw new ApiError(ErrorCode.VALIDATION);
    if (!body.reason || body.reason.trim().length < 2) throw new ApiError(ErrorCode.VALIDATION, '必须填写修改原因');
    const before = await query(
      `SELECT config FROM game_configs WHERE game_id=$1 AND config_key=$2 AND status='active' ORDER BY id DESC LIMIT 1`,
      [body.gameId, body.configKey],
    );
    await query(
      `INSERT INTO game_configs (game_id, config_key, rule_version, config, status, created_by)
       VALUES ($1,$2,$3,$4,'active',$5)
       ON CONFLICT (game_id, config_key, rule_version) DO UPDATE SET config=EXCLUDED.config`,
      [body.gameId, body.configKey, body.ruleVersion, JSON.stringify(body.config), req.adminId],
    );
    await query(
      `INSERT INTO config_versions (scope, ref_id, admin_id, reason, before, after, admin_ip)
       VALUES ('game_config',$1,$2,$3,$4,$5,$6)`,
      [
        `${body.gameId}/${body.configKey}/${body.ruleVersion}`,
        req.adminId,
        body.reason,
        before.rows[0] ? JSON.stringify(before.rows[0].config) : null,
        JSON.stringify(body.config),
        req.ip,
      ],
    );
    await audit(req, 'config.publish', `${body.gameId}/${body.configKey}`, before.rows[0]?.config, body.config, body.reason);
    return ok();
  });

  app.get('/api/admin/v1/config-versions', { preHandler: requireAdmin }, async (req) => {
    need(req, 'config.view');
    const r = await query(
      `SELECT id, scope, ref_id, admin_id, reason, admin_ip, created_at FROM config_versions ORDER BY id DESC LIMIT 100`,
    );
    return ok({ items: r.rows });
  });

  // ── 公告 / 邮件 ──────────────────────────────────────
  app.post('/api/admin/v1/announcements', { preHandler: requireAdmin }, async (req) => {
    need(req, 'announce.manage');
    const b = req.body as { title?: string; titleKo?: string; body?: string; bodyKo?: string; sort?: number };
    if (!b.title || !b.body) throw new ApiError(ErrorCode.VALIDATION);
    await query(
      `INSERT INTO announcements (title, title_ko, body, body_ko, sort, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [b.title, b.titleKo ?? '', b.body, b.bodyKo ?? '', b.sort ?? 0, req.adminId],
    );
    await audit(req, 'announce.create', 'announcements', undefined, b);
    return ok();
  });

  app.post('/api/admin/v1/announcements/:id/disable', { preHandler: requireAdmin }, async (req) => {
    need(req, 'announce.manage');
    const id = Number((req.params as { id: string }).id);
    await query(`UPDATE announcements SET status='disabled' WHERE id=$1`, [id]);
    await audit(req, 'announce.disable', `announcement:${id}`, undefined, undefined);
    return ok();
  });

  app.post('/api/admin/v1/mail/send', { preHandler: requireAdmin }, async (req) => {
    need(req, 'mail.send');
    const b = req.body as { toUid?: number; title?: string; body?: string; attachments?: { currency: Currency; amount: number }[]; confirm?: boolean };
    if (!b.toUid || !b.title || !b.body) throw new ApiError(ErrorCode.VALIDATION);
    const atts = b.attachments ?? [];
    if (atts.length > 0) {
      if (!b.confirm) throw new ApiError(ErrorCode.ADMIN_CONFIRM_REQUIRED, '带附件邮件需二次确认');
      need(req, 'wallet.adjust');
      for (const a of atts) {
        if (!Number.isInteger(a.amount) || a.amount <= 0 || a.amount > 10_000_000) throw new ApiError(ErrorCode.AMOUNT_INVALID);
      }
    }
    const mailId = await sendSystemMail(b.toUid, b.title.slice(0, 60), b.body.slice(0, 2000), atts);
    await audit(req, 'mail.send', `user:${b.toUid}`, undefined, { mailId, attachments: atts });
    return ok({ mailId });
  });

  // ── 风控 / 封禁 / 审计 ────────────────────────────────
  app.get('/api/admin/v1/risk-events', { preHandler: requireAdmin }, async (req) => {
    need(req, 'risk.view');
    const q = req.query as { status?: string; page?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const params: unknown[] = [];
    let cond = '1=1';
    if (q.status) {
      params.push(q.status);
      cond = `status=$${params.length}`;
    }
    params.push(50, (page - 1) * 50);
    const r = await query(
      `SELECT id, user_id, type, severity, evidence, status, created_at FROM risk_events WHERE ${cond}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok({ page, items: r.rows });
  });

  app.post('/api/admin/v1/risk-events/:id/handle', { preHandler: requireAdmin }, async (req) => {
    need(req, 'risk.handle');
    const id = Number((req.params as { id: string }).id);
    const action = (req.body as { action?: string }).action;
    if (!['handled', 'ignored', 'reviewing'].includes(action ?? '')) throw new ApiError(ErrorCode.VALIDATION);
    await query(`UPDATE risk_events SET status=$2, handled_by=$3, handled_at=now() WHERE id=$1`, [id, action, req.adminId]);
    await audit(req, 'risk.handle', `risk:${id}`, undefined, { action });
    return ok();
  });

  app.get('/api/admin/v1/bans', { preHandler: requireAdmin }, async (req) => {
    need(req, 'user.ban');
    const r = await query(
      `SELECT id, target_type, target, reason, until_at, operator_id, lifted_at, created_at FROM bans ORDER BY created_at DESC LIMIT 100`,
    );
    return ok({ items: r.rows });
  });

  app.get('/api/admin/v1/audit-logs', { preHandler: requireAdmin }, async (req) => {
    need(req, 'audit.view');
    const q = req.query as { adminId?: string; action?: string; page?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const cond: string[] = ['1=1'];
    const params: unknown[] = [];
    if (q.adminId) {
      params.push(Number(q.adminId));
      cond.push(`admin_id=$${params.length}`);
    }
    if (q.action) {
      params.push(`${q.action}%`);
      cond.push(`action LIKE $${params.length}`);
    }
    params.push(50, (page - 1) * 50);
    const r = await query(
      `SELECT id, admin_id, action, target, before, after, reason, admin_ip, created_at
       FROM audit_logs WHERE ${cond.join(' AND ')} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return ok({ page, items: r.rows });
  });

  // ── 后台账号管理 ─────────────────────────────────────
  app.get('/api/admin/v1/admins', { preHandler: requireAdmin }, async (req) => {
    need(req, 'admin.manage');
    const r = await query(
      `SELECT a.id, a.username, a.display_name, a.status, a.last_login_at, a.last_login_ip,
              COALESCE(json_agg(ro.code) FILTER (WHERE ro.code IS NOT NULL), '[]') AS roles
       FROM admins a
       LEFT JOIN admin_roles ar ON ar.admin_id=a.id
       LEFT JOIN roles ro ON ro.id=ar.role_id
       GROUP BY a.id ORDER BY a.id`,
    );
    return ok({ items: r.rows });
  });

  app.post('/api/admin/v1/admins', { preHandler: requireAdmin }, async (req) => {
    need(req, 'admin.manage');
    const b = req.body as { username?: string; password?: string; displayName?: string; roles?: string[] };
    if (!b.username || !/^[a-zA-Z0-9_]{3,20}$/.test(b.username)) throw new ApiError(ErrorCode.VALIDATION, '用户名 3-20 位字母数字');
    if (!b.password || b.password.length < 10) throw new ApiError(ErrorCode.VALIDATION, '密码需 ≥10 位');
    const r = await query(
      `INSERT INTO admins (username, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id`,
      [b.username, hashPassword(b.password), b.displayName ?? b.username],
    );
    const adminId = r.rows[0]!.id as number;
    for (const code of b.roles ?? []) {
      await query(`INSERT INTO admin_roles (admin_id, role_id) SELECT $1, id FROM roles WHERE code=$2 ON CONFLICT DO NOTHING`, [adminId, code]);
    }
    await audit(req, 'admin.create', `admin:${adminId}`, undefined, { username: b.username, roles: b.roles });
    return ok({ adminId });
  });

  app.get('/api/admin/v1/roles', { preHandler: requireAdmin }, async (req) => {
    need(req, 'admin.manage');
    const r = await query(
      `SELECT r.id, r.code, r.name, COALESCE(json_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '[]') AS permissions
       FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
       GROUP BY r.id ORDER BY r.id`,
    );
    return ok({ items: r.rows });
  });
}
