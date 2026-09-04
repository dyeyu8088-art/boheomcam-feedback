#!/usr/bin/env node
/**
 * 本机一键启动（PC 与同一 Wi-Fi 的手机 APK 联调）：
 *   pnpm dev:all
 * 顺序：docker 基础设施（PostgreSQL / Redis）→ 建库迁移 → api / game / client / admin 四个 dev 进程并行（前缀输出），
 * 最后打印手机端 APK「服务器设置」要填的局域网地址（http://<本机IP>:5173）。Ctrl+C 一次全部退出。
 * 前置：Node 22 + pnpm + Docker Desktop（已启动）。Windows 需允许 5173 端口入站（首次启动会弹防火墙提示）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIN = process.platform === 'win32';
const CLIENT_PORT = Number(process.env.CLIENT_PORT ?? 5173);
const PG_PORT = 5433;

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: WIN });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败（exit ${r.status}）`);
}
function portOpen(port) {
  return new Promise((resolve) => {
    const s = createConnection({ host: '127.0.0.1', port });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}
async function waitPort(port, label, timeoutMs = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await portOpen(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} :${port} 未就绪`);
}
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      if (/^(vEthernet|docker|br-|veth|virbr|vmnet|utun)/i.test(name)) continue; // 虚拟网卡手机连不上
      out.push(i.address);
    }
  }
  return out;
}

const children = [];
function start(name, args, color) {
  const child = spawn(WIN ? 'pnpm.cmd' : 'pnpm', args, { cwd: ROOT, shell: WIN, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const l of lines) process.stdout.write(tag + l + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${tag}退出（code ${code}）\n`);
    if (!stopping) shutdown(1);
  });
  children.push(child);
  return child;
}
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (WIN) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
  console.log('[dev-all] 启动 PostgreSQL / Redis（docker compose）…');
  try {
    sh('docker', ['compose', '-f', 'deploy/docker-compose.yml', 'up', '-d', 'postgres', 'redis']);
  } catch (e) {
    console.error('[dev-all] docker 启动失败：请先启动 Docker Desktop（或 dockerd）后重试。');
    throw e;
  }
  await waitPort(PG_PORT, 'PostgreSQL');
  await new Promise((r) => setTimeout(r, 1500)); // 容器内 PG 首次初始化后再等一拍
  console.log('[dev-all] 建库 / 迁移 / 种子（幂等）…');
  sh('pnpm', ['migrate']);

  start('api', ['dev:api'], '36');
  start('game', ['dev:game'], '35');
  start('client', ['dev:client'], '33');
  start('admin', ['dev:admin'], '32');
  await waitPort(8080, 'api');
  await waitPort(8090, 'game');
  await waitPort(CLIENT_PORT, 'client');

  const ips = lanAddresses();
  console.log('\n==============================================');
  console.log(' 全部就绪。手机与本机连同一 Wi-Fi，APK 登录页「服务器设置」填：');
  for (const ip of ips) console.log(`   http://${ip}:${CLIENT_PORT}`);
  if (!ips.length) console.log('   （未找到局域网 IPv4，请用 ipconfig / ifconfig 查看本机 IP）');
  console.log(` 本机浏览器：http://localhost:${CLIENT_PORT}   管理后台：http://localhost:5174`);
  console.log(' Windows 首次启动若弹出防火墙提示请选择「允许」，否则手机连不上 5173。Ctrl+C 停止全部。');
  console.log('==============================================\n');
} catch (e) {
  console.error(`[dev-all] ${e.message}`);
  shutdown(1);
}
