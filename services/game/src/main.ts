/** game-service 启动入口：WS 网关 + 匹配循环 + 在线统计 + 节点心跳 */
import { getLogger, getPool, initIdGenerator, loadEnv, query, getRedis } from '@yanbian/server-core';
import { startGateway, wireUserBus } from './gateway.js';
import { startMatchLoop } from './matchmaker.js';
import { roomManager } from './room.js';

const log = getLogger('game-main');

async function main(): Promise<void> {
  const env = loadEnv();
  initIdGenerator(Number(process.env.NODE_INDEX ?? 2));
  await getPool().query('SELECT 1');

  startGateway(env.gamePort);
  wireUserBus();
  startMatchLoop();

  await query(
    `INSERT INTO server_nodes (node_id, kind, roles) VALUES ($1,'game',$2)
     ON CONFLICT (node_id) DO UPDATE SET roles=$2, last_heartbeat_at=now(), status='online'`,
    [env.serverId, process.env.GAME_ROLES ?? 'all'],
  );

  // 节点心跳 + 桌游在线统计
  setInterval(() => {
    void (async () => {
      await query(`UPDATE server_nodes SET last_heartbeat_at=now() WHERE node_id=$1`, [env.serverId]).catch(() => undefined);
      const counts: Record<string, number> = { mahjong_yanbian: 0, hongshi: 0 };
      for (const room of roomManager.rooms.values()) {
        counts[room.gameCode] = (counts[room.gameCode] ?? 0) + room.players.filter((p) => !p.isBot).length;
      }
      const redis = getRedis();
      await redis.set('online:game:mahjong_yanbian', String(counts.mahjong_yanbian ?? 0)).catch(() => undefined);
      await redis.set('online:game:hongshi', String(counts.hongshi ?? 0)).catch(() => undefined);
    })();
  }, 5000).unref();

  log.info({ port: env.gamePort }, 'game-service started');
}

main().catch((e) => {
  log.error({ err: e instanceof Error ? e.message : String(e) }, 'game-service failed to start');
  process.exit(1);
});
