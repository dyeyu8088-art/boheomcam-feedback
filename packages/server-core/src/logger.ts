/** 结构化日志（pino）：统一字段 service/server_id/user_id/room_id/round_id/request_id */
import { pino, type Logger } from 'pino';
import { loadEnv } from './env.js';

let root: Logger | null = null;

export function getLogger(service: string): Logger {
  if (!root) {
    const env = loadEnv();
    root = pino({
      level: env.logLevel,
      base: { server_id: env.serverId, env: env.nodeEnv },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: ['password', '*.password', '*.passwordHash', 'phone', '*.phone'], censor: '[redacted]' },
    });
  }
  return root.child({ service });
}
