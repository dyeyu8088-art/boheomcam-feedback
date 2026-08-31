/**
 * WS 负载测试：N 个并发连接（默认 500），每连接周期心跳 + 部分连接做水果机 Spin。
 * 用法：node tests/load-ws.mjs [connections] [spinRatio]
 * 输出：连接成功率、心跳 RTT 分位数、Spin 时延分位数、错误数。
 * 说明：单机压测受本机端口/CPU 限制；生产压测在独立压力机上执行 1k/5k/10k 阶梯。
 */
import WebSocket from 'ws';

const N = Number(process.argv[2] ?? 500);
const SPIN_RATIO = Number(process.argv[3] ?? 0.1);
const API = 'http://localhost:8080';
const WS = 'ws://localhost:8090/ws';

const rtts = [];
const spinLat = [];
let connected = 0;
let errors = 0;

function pct(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function makeClient(i) {
  const r = await fetch(`${API}/api/v1/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestKey: `load-${Date.now()}-${i}`, deviceId: `load-dev-${i}` }),
  }).then((x) => x.json());
  if (r.code !== 0) throw new Error('login failed');
  const token = r.data.accessToken;
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS}?token=${token}`);
    let seq = 0;
    const pending = new Map();
    ws.on('open', () => {
      connected += 1;
      const doSpin = Math.random() < SPIN_RATIO;
      const timer = setInterval(() => {
        seq += 1;
        const t = Date.now();
        pending.set('ping', t);
        ws.send(JSON.stringify({ v: 1, event: 'sys.ping', seq, timestamp: t, data: { t } }));
      }, 5000);
      if (doSpin) {
        seq += 1;
        ws.send(JSON.stringify({ v: 1, event: 'slot.enter', seq, timestamp: Date.now(), data: {}, requestId: `le-${i}` }));
        const spinTimer = setInterval(() => {
          seq += 1;
          const t = Date.now();
          pending.set(`spin-${seq}`, t);
          ws.send(
            JSON.stringify({ v: 1, event: 'slot.spin', seq, timestamp: t, data: { betPerLine: 100, lines: 20 }, requestId: `ls-${i}-${seq}` }),
          );
        }, 4000 + Math.random() * 2000);
        setTimeout(() => clearInterval(spinTimer), 25000);
      }
      setTimeout(() => {
        clearInterval(timer);
        ws.close();
        resolve(null);
      }, 30000);
    });
    ws.on('message', (buf) => {
      const m = JSON.parse(buf.toString());
      if (m.event === 'sys.pong') {
        const t = pending.get('ping');
        if (t) rtts.push(Date.now() - t);
      }
      if (m.event === 'slot.spinResult' && m.ack !== undefined) {
        for (const [k, t] of pending) {
          if (k.startsWith('spin-')) {
            spinLat.push(Date.now() - t);
            pending.delete(k);
            break;
          }
        }
      }
      if (m.event === 'sys.error') errors += 1;
    });
    ws.on('error', () => {
      errors += 1;
      resolve(null);
    });
  });
}

console.log(`load test: ${N} connections, spinRatio=${SPIN_RATIO}, 30s`);
const t0 = Date.now();
const batches = [];
for (let i = 0; i < N; i += 50) {
  batches.push(Promise.all(Array.from({ length: Math.min(50, N - i) }, (_, j) => makeClient(i + j).catch(() => (errors += 1)))));
  await new Promise((r) => setTimeout(r, 120)); // 阶梯上量
}
await Promise.all(batches);

console.log(`connected: ${connected}/${N} (${((connected / N) * 100).toFixed(1)}%)`);
console.log(`heartbeat RTT ms: p50=${pct(rtts, 50)} p95=${pct(rtts, 95)} p99=${pct(rtts, 99)} (n=${rtts.length})`);
console.log(`spin latency ms: p50=${pct(spinLat, 50)} p95=${pct(spinLat, 95)} p99=${pct(spinLat, 99)} (n=${spinLat.length})`);
console.log(`errors: ${errors}, duration: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
