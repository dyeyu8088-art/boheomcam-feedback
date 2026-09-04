/**
 * api-service 启动入口。
 * SERVICE_ROLES 控制装载模块（默认全部）：auth,user,wallet,activity,social,config,admin
 * activity 角色同时装载 vip / inventory / shop / tournament（含赛事调度）
 * —— 生产环境可按角色拆分容器水平扩展（见 deploy/docker-compose.prod.yml）。
 */
import { getLogger, getPool, initIdGenerator, loadEnv, query } from '@yanbian/server-core';
import { buildServer } from './server.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerUserRoutes } from './modules/user/routes.js';
import { registerWalletRoutes } from './modules/wallet/routes.js';
import { registerActivityRoutes } from './modules/activity/routes.js';
import { registerSocialRoutes } from './modules/social/routes.js';
import { registerConfigRoutes } from './modules/config/routes.js';
import { registerAdminRoutes } from './modules/admin/routes.js';
import { registerVipRoutes } from './modules/vip/routes.js';
import { registerInventoryRoutes } from './modules/inventory/routes.js';
import { registerShopRoutes } from './modules/shop/routes.js';
import { registerTournamentRoutes, startTournamentScheduler } from './modules/tournament/routes.js';
import { registerSupportAdminRoutes, registerSupportRoutes } from './modules/support/routes.js';

const log = getLogger('api-main');

async function main(): Promise<void> {
  const env = loadEnv();
  initIdGenerator(Number(process.env.NODE_INDEX ?? 1));
  await getPool().query('SELECT 1'); // fail fast

  const roles = (process.env.SERVICE_ROLES ?? 'auth,user,wallet,activity,social,config,admin')
    .split(',')
    .map((s) => s.trim());
  const app = await buildServer();

  const registry: Record<string, (a: Awaited<ReturnType<typeof buildServer>>) => void> = {
    auth: registerAuthRoutes,
    user: registerUserRoutes,
    wallet: registerWalletRoutes,
    activity: (a) => {
      registerActivityRoutes(a);
      registerVipRoutes(a);
      registerInventoryRoutes(a);
      registerShopRoutes(a);
      registerTournamentRoutes(a);
      startTournamentScheduler();
    },
    social: (a) => {
      registerSocialRoutes(a);
      registerSupportRoutes(a);
    },
    config: registerConfigRoutes,
    admin: (a) => {
      registerAdminRoutes(a);
      registerSupportAdminRoutes(a);
    },
  };
  for (const role of roles) {
    const fn = registry[role];
    if (!fn) {
      log.warn({ role }, 'unknown SERVICE_ROLE ignored');
      continue;
    }
    fn(app);
  }

  await query(
    `INSERT INTO server_nodes (node_id, kind, roles) VALUES ($1,'api',$2)
     ON CONFLICT (node_id) DO UPDATE SET roles=$2, last_heartbeat_at=now(), status='online'`,
    [env.serverId, roles.join(',')],
  );
  setInterval(() => {
    void query(`UPDATE server_nodes SET last_heartbeat_at=now() WHERE node_id=$1`, [env.serverId]).catch(() => undefined);
  }, 15000).unref();

  await app.listen({ port: env.apiPort, host: '0.0.0.0' });
  log.info({ port: env.apiPort, roles }, 'api-service started');
}

main().catch((e) => {
  log.error({ err: e instanceof Error ? e.message : String(e) }, 'api-service failed to start');
  process.exit(1);
});
