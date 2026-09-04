/** config-service：品牌（白标）、大厅信息（游戏与场次、在线人数） */
import type { FastifyInstance } from 'fastify';
import { getRedis, query } from '@yanbian/server-core';
import { ok } from '../../server.js';

export function registerConfigRoutes(app: FastifyInstance): void {
  app.get('/api/v1/config/brand', async () => {
    const r = await query(
      `SELECT config FROM game_configs WHERE config_key='brand' AND status='active' ORDER BY id DESC LIMIT 1`,
    );
    return ok(r.rows[0]?.config ?? { nameZh: '延边游戏', nameKo: '연변 게임', nameEn: 'YANBIAN GAME' });
  });

  /** 大厅：游戏列表 + 场次 + 实时在线 */
  app.get('/api/v1/lobby', async () => {
    const games = await query(`SELECT game_id, name, name_ko, status, sort FROM games ORDER BY sort`);
    const redis = getRedis();
    const items = [] as Record<string, unknown>[];
    for (const g of games.rows) {
      const online = Number((await redis.get(`online:game:${g.game_id}`)) ?? 0);
      const stagesRow = await query(
        `SELECT config FROM game_configs WHERE game_id=$1 AND config_key IN ('stages') AND status='active' ORDER BY id DESC LIMIT 1`,
        [g.game_id],
      );
      items.push({
        gameId: g.game_id,
        name: g.name,
        nameKo: g.name_ko,
        status: g.status,
        online,
        stages: (stagesRow.rows[0]?.config as { stages?: unknown[] } | undefined)?.stages ?? [],
      });
    }
    const totalOnline = Number((await redis.get('online:total')) ?? 0);
    return ok({ games: items, totalOnline });
  });
}
