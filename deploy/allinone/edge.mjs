/**
 * 一体化容器边缘（无第三方依赖）：静态文件（/ → 游戏客户端，/admin/ → 管理后台）+ /api 反代 api:8080 + /ws 升级转发 game:8090。
 * 生产环境用 nginx（deploy/nginx/gateway.conf）；本文件只服务单容器内测部署。
 */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 80);
const API_PORT = Number(process.env.API_PORT ?? 18080);
const GAME_PORT = Number(process.env.GAME_PORT ?? 18090);
const CLIENT_ROOT = '/srv/www/client';
const ADMIN_ROOT = '/srv/www/admin';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function serveStatic(root, urlPath, res) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '' || rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(file, (err, st) => {
    const target = !err && st.isFile() ? file : path.join(root, 'index.html'); // SPA 回退
    fs.stat(target, (err2, st2) => {
      if (err2 || !st2.isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      const headers = { 'content-type': MIME[ext] ?? 'application/octet-stream', 'content-length': st2.size, 'x-content-type-options': 'nosniff' };
      headers['cache-control'] = target.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
      res.writeHead(200, headers);
      fs.createReadStream(target).pipe(res);
    });
  });
}

function proxy(req, res, port) {
  const headers = { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress ?? '', 'x-real-ip': req.socket.remoteAddress ?? '' };
  const up = http.request({ host: '127.0.0.1', port, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end('{"code":1000,"msg":"upstream unavailable","data":{}}');
  });
  req.pipe(up);
}

const server = http.createServer((req, res) => {
  const p = (req.url ?? '/').split('?')[0];
  if (p.startsWith('/api/')) return proxy(req, res, API_PORT);
  if (p === '/admin') {
    res.writeHead(301, { location: '/admin/' });
    return res.end();
  }
  if (p.startsWith('/admin/')) return serveStatic(ADMIN_ROOT, p.slice('/admin'.length), res);
  return serveStatic(CLIENT_ROOT, p, res);
});

// WebSocket：原样转发升级请求到 game 网关
server.on('upgrade', (req, socket, head) => {
  if (!(req.url ?? '').startsWith('/ws')) {
    socket.destroy();
    return;
  }
  const up = net.connect(GAME_PORT, '127.0.0.1', () => {
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    raw += `X-Forwarded-For: ${socket.remoteAddress ?? ''}\r\n\r\n`;
    up.write(raw);
    if (head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.keepAliveTimeout = 65000;
server.on('error', (e) => {
  console.error(`[edge] listen failed on ${PORT}: ${e.message}`);
  process.exit(1);
});
server.listen(PORT, '0.0.0.0', () => console.log(`[edge] listening on ${PORT} (api ${API_PORT}, game ${GAME_PORT})`));
