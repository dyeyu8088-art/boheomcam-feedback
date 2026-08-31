/** 环境配置装载：全部敏感值经环境变量注入（.env 不入库） */
export interface ServerEnv {
  nodeEnv: 'local' | 'development' | 'staging' | 'production';
  serverId: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtAccessTtlSec: number;
  refreshTtlDays: number;
  internalToken: string;
  apiPort: number;
  gamePort: number;
  adminInitPassword: string | null;
  logLevel: string;
}

function required(name: string, fallbackForDev?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  const env = process.env.NODE_ENV ?? 'local';
  if (env !== 'production' && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Missing required env: ${name}`);
}

let cached: ServerEnv | null = null;

export function loadEnv(): ServerEnv {
  if (cached) return cached;
  const nodeEnv = (process.env.NODE_ENV ?? 'local') as ServerEnv['nodeEnv'];
  cached = {
    nodeEnv,
    serverId: process.env.SERVER_ID ?? `node-${process.pid}`,
    databaseUrl: required('DATABASE_URL', 'postgres://yanbian:yanbian_dev@localhost:5433/yanbian'),
    redisUrl: required('REDIS_URL', 'redis://localhost:6380'),
    jwtSecret: required('JWT_SECRET', 'dev-only-jwt-secret-change-me'),
    jwtAccessTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC ?? 900),
    refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 30),
    internalToken: required('INTERNAL_TOKEN', 'dev-only-internal-token'),
    apiPort: Number(process.env.API_PORT ?? 8080),
    gamePort: Number(process.env.GAME_PORT ?? 8090),
    adminInitPassword: process.env.ADMIN_INIT_PASSWORD ?? null,
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
  if (nodeEnv === 'production') {
    if (cached.jwtSecret.includes('dev-only') || cached.internalToken.includes('dev-only')) {
      throw new Error('Production must not use dev-only secrets');
    }
  }
  return cached;
}
