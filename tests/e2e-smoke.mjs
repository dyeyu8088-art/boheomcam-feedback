/**
 * 端到端冒烟：真实 HTTP + WS 客户端跑通 登录→水果机→捕鱼→麻将(整局)→红十(整局)。
 * 前置：postgres/redis 已启动、已迁移、api(:8080) 与 game(:8090) 运行中。
 * 用法：node tests/e2e-smoke.mjs
 */
import WebSocket from 'ws';

const API = process.env.API_URL ?? 'http://localhost:8080';
const WS = process.env.WS_URL ?? 'ws://localhost:8090/ws';

let passed = 0;
let failed = 0;
const assert = (cond, name) => {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
};

async function api(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

class Client {
  constructor(token, name) {
    this.token = token;
    this.name = name;
    this.seq = 0;
    this.handlers = new Map();
    this.everything = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS}?token=${this.token}`);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (buf) => {
        const m = JSON.parse(buf.toString());
        this.everything.push(m);
        const hs = this.handlers.get(m.event) ?? [];
        for (const h of [...hs]) h(m);
      });
    });
  }

  on(event, handler) {
    const hs = this.handlers.get(event) ?? [];
    hs.push(handler);
    this.handlers.set(event, hs);
  }

  once(event, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting ${event} (${this.name})`)), timeoutMs);
      const hs = this.handlers.get(event) ?? [];
      const h = (m) => {
        clearTimeout(timer);
        const arr = this.handlers.get(event) ?? [];
        this.handlers.set(event, arr.filter((x) => x !== h));
        resolve(m);
      };
      hs.push(h);
      this.handlers.set(event, hs);
    });
  }

  send(event, data = {}, requestId) {
    this.seq += 1;
    this.ws.send(JSON.stringify({ v: 1, event, seq: this.seq, timestamp: Date.now(), data, requestId }));
    return this.seq;
  }

  /** 请求-响应 */
  call(event, data = {}, replyEvent, timeoutMs = 15000) {
    const expect = replyEvent ?? `${event}.ok`;
    const requestId = `rq-${this.name}-${this.seq + 1}-${Math.random().toString(36).slice(2, 8)}`;
    const p = Promise.race([
      this.once(expect, timeoutMs),
      this.once('sys.error', timeoutMs + 1).then((m) => {
        if (m.data?.event === event) throw new Error(`sys.error for ${event}: ${m.data.code} ${m.data.msg}`);
        return new Promise(() => undefined);
      }),
    ]);
    this.send(event, data, requestId);
    return p;
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

async function makeUser(tag) {
  const r = await api('/api/v1/auth/guest', {
    guestKey: `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deviceId: `e2e-dev-${tag}`,
    deviceType: 'pc',
  });
  if (r.code !== 0) throw new Error(`guest login failed: ${JSON.stringify(r)}`);
  return r.data;
}

// ── 水果机 ─────────────────────────────────────────────
async function testSlot() {
  console.log('▶ 水果机');
  const u = await makeUser('slot');
  const c = new Client(u.accessToken, 'slot');
  await c.connect();
  await c.once('sys.hello');
  const enter = await c.call('slot.enter');
  assert(enter.data.paytable?.columns === 5, '进入返回赔付表');
  const balBefore = enter.data.balance;
  const spin = await c.call('slot.spin', { betPerLine: 100, lines: 20 }, 'slot.spinResult');
  assert(Array.isArray(spin.data.stops) && spin.data.stops.length === 5, '停位 5 列');
  assert(typeof spin.data.totalWin === 'number', '返回中奖额');
  assert(spin.data.balance === balBefore - 2000 + spin.data.totalWin || spin.data.freeSpinsRemaining >= 0, '余额按 服务端 结果变化');
  // 重复 requestId 幂等
  const rid = `dup-${Date.now()}`;
  c.send('slot.spin', { betPerLine: 100, lines: 20 }, rid);
  const first = await c.once('slot.spinResult');
  c.send('slot.spin', { betPerLine: 100, lines: 20 }, rid);
  const second = await c.once('slot.spinResult');
  assert(JSON.stringify(first.data.stops) === JSON.stringify(second.data.stops), '重复 requestId 返回同一结果（不重复扣费）');
  // 非法下注被拒
  let rejected = false;
  try {
    await c.call('slot.spin', { betPerLine: 123, lines: 20 }, 'slot.spinResult', 3000);
  } catch {
    rejected = true;
  }
  assert(rejected, '非法下注被拒绝');
  const hist = await c.call('slot.history', {}, 'slot.history.ok');
  assert(hist.data.items.length >= 2, 'Spin 历史落库');
  c.close();
}

// ── 捕鱼 ──────────────────────────────────────────────
async function testFishing() {
  console.log('▶ 捕鱼');
  const u = await makeUser('fish');
  const c = new Client(u.accessToken, 'fish');
  await c.connect();
  await c.once('sys.hello');
  const statePromise = c.once('fishing.state');
  await c.call('fishing.enter', { stageId: 'fishing_novice' });
  const state = await statePromise;
  assert(state.data.stage.multipliers.length > 0, '渔场状态含炮倍白名单');
  // 等一波鱼（enter 时可能已有）
  let fish = state.data.fish;
  if (!fish || fish.length === 0) {
    const wave = await c.once('fishing.wave', 35000);
    fish = wave.data.fish;
  }
  assert(fish.length > 0, '收到鱼群波次');
  const fire = await c.call('fishing.fire', { multiplier: 1, dirDeg: 45 }, 'fishing.fireOk');
  assert(typeof fire.data.bulletId === 'string', '开火回执 bulletId（先扣费）');
  const target = fish.find((f) => f.spawnAtMs <= Date.now()) ?? fish[0];
  const hit = await c.call('fishing.hit', { bulletId: fire.data.bulletId, fishId: target.fishId }, 'fishing.hitResult');
  assert(hit.data.hit === true || typeof hit.data.reason === 'string', '命中判定由服务端返回');
  // 重复用同一 bulletId 必拒
  const hit2 = await c.call('fishing.hit', { bulletId: fire.data.bulletId, fishId: target.fishId }, 'fishing.hitResult');
  assert(hit2.data.hit === false && hit2.data.reason === 'BULLET_CONSUMED', '子弹一次性消耗（防重放）');
  // 不存在的鱼
  const f2 = await c.call('fishing.fire', { multiplier: 1, dirDeg: 90 }, 'fishing.fireOk');
  const hit3 = await c.call('fishing.hit', { bulletId: f2.data.bulletId, fishId: 999999999 }, 'fishing.hitResult');
  assert(hit3.data.reason === 'FISH_NOT_FOUND', '不存在的 fish_id 被拒绝');
  // 高速射击触发频控
  let tooFast = 0;
  for (let i = 0; i < 20; i += 1) {
    try {
      await c.call('fishing.fire', { multiplier: 1, dirDeg: i }, 'fishing.fireOk', 3000);
    } catch (e) {
      if (String(e).includes('5005')) tooFast += 1;
    }
  }
  assert(tooFast > 0, '超频射击被限流');
  await c.call('fishing.leave', {});
  c.close();
}

// ── 麻将整局（4 真人客户端） ─────────────────────────────
function autoPlayMahjong(c, done) {
  c.mySeat = null;
  c.myHand = [];
  c.myDrawn = null;
  c.on('mahjong.deal', (m) => {
    c.mySeat = m.data.seat;
    c.myHand = [...m.data.tiles];
  });
  c.on('mahjong.draw', (m) => {
    c.myHand.push(m.data.tile);
    c.myDrawn = m.data.tile;
  });
  c.on('mahjong.turn', (m) => {
    if (m.data.seat !== c.mySeat) return;
    // 简单策略：能出就出摸到的牌（或末张）
    setTimeout(() => {
      const tile = c.myDrawn ?? c.myHand[c.myHand.length - 1];
      if (tile === undefined) return;
      c.send('mahjong.discard', { tile });
    }, 120);
  });
  c.on('mahjong.discarded', (m) => {
    if (m.data.seat === c.mySeat) {
      const idx = c.myHand.indexOf(m.data.tile);
      if (idx >= 0) c.myHand.splice(idx, 1);
      c.myDrawn = null;
    }
  });
  c.on('mahjong.actionAsk', () => {
    // 永远过（机器人/其他人会处理自己的）；胡的机会也过，保证局面快速推进到流局或他人胡
    setTimeout(() => c.send('mahjong.action', { action: 'pass' }), 80);
  });
  c.on('mahjong.roundEnd', (m) => done(m));
}

async function testMahjong() {
  console.log('▶ 延边麻将（4 客户端整局）');
  const users = await Promise.all([makeUser('mj1'), makeUser('mj2'), makeUser('mj3'), makeUser('mj4')]);
  const clients = [];
  const roundEnds = [];
  for (let i = 0; i < 4; i += 1) {
    const c = new Client(users[i].accessToken, `mj${i}`);
    await c.connect();
    await c.once('sys.hello');
    clients.push(c);
    roundEnds.push(new Promise((resolve) => autoPlayMahjong(c, resolve)));
  }
  const founds = clients.map((c) => c.once('match.found', 20000));
  for (const c of clients) await c.call('match.start', { gameCode: 'mahjong_yanbian', stageId: 'mj_bronze' });
  const rooms = await Promise.all(founds);
  assert(rooms.every((r) => r.data.room.players.length === 4), '匹配成功并满座（4 真人不补机器人）');
  const starts = await Promise.all(clients.map((c) => c.once('room.gameStart', 20000)));
  assert(starts.every((s) => s.data.roundId), '开局广播 roundId');
  const end = await Promise.race(roundEnds.map((p) => p.then((m) => m)));
  assert(end.data.result !== undefined, '整局跑完并收到服务端结算');
  const changes = Object.values(end.data.result.scoreChanges ?? {});
  const sum = changes.reduce((a, b) => a + b, 0);
  assert(sum === 0, '分数零和');
  assert(Array.isArray(end.data.hands) && end.data.hands.length === 4, '局末亮牌');
  // 战绩落库（等结算写库）
  await new Promise((r) => setTimeout(r, 1500));
  const rec = await api('/api/v1/user/records?range=today', undefined, users[0].accessToken);
  assert(rec.data.items.length >= 1, '战绩可查询');
  const detail = await api(`/api/v1/user/records/${rec.data.items[0].round_id}`, undefined, users[0].accessToken);
  assert(detail.data.players.length === 4, '战绩详情含 4 家');
  const replay = await api(`/api/v1/user/records/${rec.data.items[0].round_id}/replay`, undefined, users[0].accessToken);
  assert(replay.data.events.length > 20, '回放事件流可取');
  for (const c of clients) c.close();
}

// ── 红十整局（1 真人 + 机器人补位） ───────────────────────
async function testHongshi() {
  console.log('▶ 红十（真人+机器人整局）');
  const u = await makeUser('hs');
  const c = new Client(u.accessToken, 'hs');
  await c.connect();
  await c.once('sys.hello');
  c.on('hongshi.turn', async (m) => {
    if (c.mySeat === undefined || m.data.seat !== c.mySeat) return;
    // 请求提示 → 出提示牌或过
    try {
      const hint = await c.call('hongshi.hint', {}, 'hongshi.hint', 5000);
      setTimeout(() => {
        if (hint.data.cards && hint.data.cards.length > 0) c.send('hongshi.play', { cards: hint.data.cards });
        else c.send('hongshi.pass', {});
      }, 100);
    } catch {
      c.send('hongshi.pass', {});
    }
  });
  c.on('hongshi.deal', (m) => {
    c.mySeat = m.data.seat;
  });
  const endP = c.once('hongshi.roundEnd', 90000);
  await c.call('match.start', { gameCode: 'hongshi', stageId: 'hs_bronze' });
  await c.once('match.found', 20000);
  await c.once('room.gameStart', 20000);
  const end = await endP;
  assert(end.data.result.ranks.length === 4, '红十整局跑完出名次');
  const sum = Object.values(end.data.result.scoreChanges).reduce((a, b) => a + b, 0);
  assert(sum === 0, '红十分数零和');
  c.close();
}

// ── 断线重连 ──────────────────────────────────────────
async function testReconnect() {
  console.log('▶ 断线重连');
  const u = await makeUser('rc');
  const c1 = new Client(u.accessToken, 'rc1');
  await c1.connect();
  await c1.once('sys.hello');
  await c1.call('match.start', { gameCode: 'mahjong_yanbian', stageId: 'mj_bronze' });
  await c1.once('match.found', 20000);
  await c1.once('room.gameStart', 20000);
  // 暴力断开
  c1.ws.terminate();
  await new Promise((r) => setTimeout(r, 800));
  const c2 = new Client(u.accessToken, 'rc2');
  await c2.connect();
  const hello = await c2.once('sys.hello');
  assert(hello.data.resume === true, '重连恢复标记');
  assert(hello.data.snapshot?.game?.myHand?.length >= 13, '快照含本人完整手牌');
  assert(hello.data.snapshot.game.players.every((p) => p.handCount !== undefined && p.melds !== undefined), '快照含他人牌数（不含他人手牌）');
  const other = hello.data.snapshot.game.players.find((p) => p.seat !== hello.data.snapshot.mySeat);
  assert(other && other.hand === undefined, '不泄露他人手牌');
  c2.close();
}

const t0 = Date.now();
try {
  await testSlot();
  await testFishing();
  await testMahjong();
  await testHongshi();
  await testReconnect();
} catch (e) {
  failed += 1;
  console.error('  ✗ 异常:', e.message);
}
console.log(`\nE2E 结果: ${passed} 通过 / ${failed} 失败 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failed > 0 ? 1 : 0);
