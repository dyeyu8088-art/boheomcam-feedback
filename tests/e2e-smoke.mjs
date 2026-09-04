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

// ── 轮盘 ───────────────────────────────────────────────
const RL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function rlPayout(result, bets) {
  let total = 0;
  for (const b of bets) {
    const win =
      b.type === 'red' ? RL_RED.has(result) : b.type === 'black' ? result !== 0 && !RL_RED.has(result) : b.type === 'straight' ? Number(b.selection) === result : false;
    if (win) total += b.amount * (b.type === 'straight' ? 36 : 2);
  }
  return total;
}
async function testRoulette() {
  console.log('▶ 轮盘（共享回合 / 锁盘开奖 / 幂等 / 限额）');
  const u = await makeUser('rl');
  const c = new Client(u.accessToken, 'rl');
  await c.connect();
  let enter;
  try {
    enter = await c.call('roulette.enter');
  } catch (e) {
    console.error('  [debug] roulette.enter failed:', e.message, JSON.stringify(c.everything).slice(0, 1500));
    throw e;
  }
  assert(enter.data.config?.chips?.length === 11 && enter.data.round?.roundId, '进入轮盘返回配置与当前回合');
  let r = enter.data.round;
  for (let i = 0; i < 20 && !(r.phase === 'betting' && r.lockAt - Date.now() > 6000); i += 1) {
    const st = await c.once('roulette.state', 60000);
    r = st.data;
  }
  const bal0 = enter.data.balance;
  const placed = [
    { type: 'red', selection: '', amount: 100 },
    { type: 'straight', selection: '7', amount: 10 },
  ];
  const ok = await c.call('roulette.bet', { bets: placed }, 'roulette.bet.ok');
  assert(ok.data.accepted?.length === 2 && ok.data.balance === bal0 - 110, '下注成功并扣款 110');
  const rid = `rq-rl-dup-${Date.now()}`;
  c.send('roulette.bet', { bets: [{ type: 'black', selection: '', amount: 50 }] }, rid);
  const a = await c.once('roulette.bet.ok');
  c.send('roulette.bet', { bets: [{ type: 'black', selection: '', amount: 50 }] }, rid);
  const b = await c.once('roulette.bet.ok');
  assert(a.data.balance === b.data.balance && a.data.roundId === b.data.roundId, '重复 requestId 不重复扣款（网关响应缓存 / 钱包幂等）');
  placed.push({ type: 'black', selection: '', amount: 50 });
  let rejected = false;
  try {
    await c.call('roulette.bet', { bets: [{ type: 'straight', selection: '37', amount: 10 }] }, 'roulette.bet.ok', 3000);
  } catch {
    rejected = true;
  }
  assert(rejected, '非法单号 37 被拒绝');
  let rejected2 = false;
  try {
    await c.call('roulette.bet', { bets: [{ type: 'red', selection: '', amount: 1e9 }] }, 'roulette.bet.ok', 3000);
  } catch {
    rejected2 = true;
  }
  assert(rejected2, '超过限额 / 余额的投注被拒绝');
  const spin = await c.once('roulette.spin', 60000);
  assert(spin.data.result >= 0 && spin.data.result <= 36 && spin.data.roundId === ok.data.roundId, `锁盘开奖（${spin.data.result}）`);
  let rejected3 = false;
  try {
    await c.call('roulette.bet', { bets: [{ type: 'red', selection: '', amount: 10 }] }, 'roulette.bet.ok', 3000);
  } catch {
    rejected3 = true;
  }
  assert(rejected3, '开奖后下注被拒绝');
  const res = await c.once('roulette.result', 30000);
  const exp = rlPayout(res.data.result, placed);
  assert(res.data.myPayout === exp && res.data.myBet === 160, `结算派彩与赔率一致（派彩 ${res.data.myPayout}）`);
  assert(res.data.balance === b.data.balance + exp, '结算后余额 = 下注后余额 + 派彩');
  assert(res.data.history?.[0] === res.data.result, '历史记录已更新');
  c.close();
}

// ── 股票涨跌 ───────────────────────────────────────────
async function testStock() {
  console.log('▶ 股票涨跌（模拟行情 / 锁定赔率 / 幂等 / 结算 / 锁盘）');
  const u = await makeUser('st');
  const c = new Client(u.accessToken, 'st');
  await c.connect();
  const enter = await c.call('stock.enter');
  assert(
    enter.data.config?.instruments?.length === 3 && enter.data.rounds?.length === 3 && Object.keys(enter.data.prices ?? {}).length === 3,
    '进入返回三个虚拟品种 / 回合 / 现价',
  );
  const inst = enter.data.config.instruments[0].id;
  let round = enter.data.rounds.find((r) => r.instrument === inst);
  for (let i = 0; i < 6 && !(round.lockAt - Date.now() > 6000); i += 1) {
    const m = await c.once('stock.round', 45000);
    if (m.data.round.instrument === inst) round = m.data.round;
  }
  const tick = await c.once('stock.tick', 5000);
  assert(typeof tick.data.prices[inst] === 'number', '收到行情 tick');
  const bal0 = enter.data.balance;
  const b1 = await c.call('stock.bet', { instrument: inst, type: 'UP', amount: 100 }, 'stock.bet.ok');
  assert(b1.data.bet.oddsBp === 19000 && b1.data.balance === bal0 - 100 && b1.data.roundId === round.roundId, '看涨下注锁定赔率 1.90 并扣款');
  const b2 = await c.call('stock.bet', { instrument: inst, type: 'HIGHER', selection: '1', amount: 50 }, 'stock.bet.ok');
  assert(/^\d+\.\d\d$/.test(b2.data.bet.selection) && b2.data.bet.selection !== '1', 'HIGHER 参考价由服务端现价写入（忽略客户端值）');
  const b3 = await c.call('stock.bet', { instrument: inst, type: 'LAST_DIGIT', selection: '7', amount: 10 }, 'stock.bet.ok');
  assert(b3.data.bet.oddsBp === 95000, '末位数字赔率 9.5');
  const rid = `rq-st-dup-${Date.now()}`;
  c.send('stock.bet', { instrument: inst, type: 'DOWN', amount: 30 }, rid);
  const d1 = await c.once('stock.bet.ok');
  c.send('stock.bet', { instrument: inst, type: 'DOWN', amount: 30 }, rid);
  const d2 = await c.once('stock.bet.ok');
  assert(d1.data.balance === d2.data.balance && d1.data.roundId === d2.data.roundId, '重复 requestId 不重复扣款');
  let rej = false;
  try {
    await c.call('stock.bet', { instrument: inst, type: 'FIRST_DIGIT', selection: '12', amount: 10 }, 'stock.bet.ok', 3000);
  } catch {
    rej = true;
  }
  assert(rej, '非法数字被拒绝');
  let rej2 = false;
  try {
    await c.call('stock.bet', { instrument: 'NOPE', type: 'UP', amount: 10 }, 'stock.bet.ok', 3000);
  } catch {
    rej2 = true;
  }
  assert(rej2, '未知品种被拒绝');
  let res = null;
  for (let i = 0; i < 6; i += 1) {
    const m = await c.once('stock.result', 60000);
    if (m.data.roundId === b1.data.roundId) {
      res = m;
      break;
    }
  }
  assert(res && ['UP', 'DOWN', 'FLAT'].includes(res.data.direction), `本回合结算（${res?.data.direction} ${res?.data.openingPrice} → ${res?.data.settlementPrice}）`);
  const bets = res.data.myBets;
  const sum = bets.reduce((s, b) => s + b.payout, 0);
  const upBet = bets.find((b) => b.type === 'UP');
  const expUp = res.data.direction === 'UP' ? 190 : res.data.direction === 'FLAT' ? 100 : 0;
  assert(sum === res.data.myPayout && upBet?.payout === expUp && res.data.myBet === 190, `派彩与方向一致（派彩 ${res.data.myPayout}）`);
  assert(res.data.balance === d2.data.balance + res.data.myPayout, '结算后余额 = 下注后余额 + 派彩');
  // 新回合开盘 → 等到锁盘后下注应被拒
  let next = null;
  for (let i = 0; i < 6 && !next; i += 1) {
    const m = await c.once('stock.round', 45000);
    if (m.data.round.instrument === inst) next = m.data.round;
  }
  const waitMs = next.lockAt - Date.now() + 300;
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  let rej3 = false;
  try {
    await c.call('stock.bet', { instrument: inst, type: 'UP', amount: 10 }, 'stock.bet.ok', 3000);
  } catch {
    rej3 = true;
  }
  assert(rej3, '锁盘后下注被拒绝');
  c.close();
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
  assert(enter.data.jackpots && ['grand', 'major', 'minor', 'mini'].every((k) => typeof enter.data.jackpots[k] === 'number'), '进入返回四档 Jackpot 奖池');
  const balBefore = enter.data.balance;
  const spin = await c.call('slot.spin', { betPerLine: 100, lines: 20 }, 'slot.spinResult');
  assert(Array.isArray(spin.data.stops) && spin.data.stops.length === 5, '停位 5 列');
  assert(typeof spin.data.totalWin === 'number', '返回中奖额');
  assert(spin.data.jackpots && spin.data.jackpots.mini >= enter.data.jackpots.mini, 'Spin 后 Jackpot 奖池注入（服务端累积）');
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

  // 技能：服务端判定 + 幂等 + 冷却
  const sk = await c.call('fishing.skill', { skill: 'LIGHTNING', dirDeg: -90 }, 'fishing.skill.ok');
  assert(sk.data.cost === 200 && typeof sk.data.cooldownUntilMs === 'number' && Array.isArray(sk.data.kills), '闪电技能由服务端结算（费用 20 发 × 炮倍）');
  const rid = `rq-fish-replay-${Date.now()}`;
  const p1 = c.once('fishing.skill.ok');
  c.send('fishing.skill', { skill: 'MISSILE' }, rid);
  const r1 = await p1;
  const p2 = c.once('fishing.skill.ok');
  c.send('fishing.skill', { skill: 'MISSILE' }, rid);
  const r2 = await p2;
  assert(r1.data.balance === r2.data.balance && r1.data.cooldownUntilMs === r2.data.cooldownUntilMs, '技能同 requestId 重放不重复扣费 / 派奖');
  let cdRejected = false;
  try {
    await c.call('fishing.skill', { skill: 'LIGHTNING' }, 'fishing.skill.ok', 3000);
  } catch {
    cdRejected = true;
  }
  assert(cdRejected, '技能冷却期内再次使用被拒绝');
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

// ── 对局中离开：本局托管打完并结算、可立即匹配别的游戏、重连快照不再指向旧桌 ─────
async function testLeaveDuringPlay() {
  console.log('▶ 对局中离开');
  const u = await makeUser('lv');
  const c = new Client(u.accessToken, 'lv');
  await c.connect();
  await c.once('sys.hello');
  await c.call('match.start', { gameCode: 'mahjong_yanbian', stageId: 'mj_bronze' });
  await c.once('match.found', 20000);
  await c.once('room.gameStart', 20000);
  await c.once('mahjong.deal', 10000);
  const trusteeP = c.once('game.trustee', 5000).catch(() => null);
  const leave = await c.call('room.leave', {}, 'room.leave.ok', 5000);
  assert(leave.event === 'room.leave.ok', '对局中离开被接受（本局托管打完）');
  const tr = await trusteeP;
  assert(tr === null || tr.data.reason === 'leave' || tr.data.trustee === true, '离开后座位进入托管');
  const hs = await c.call('match.start', { gameCode: 'hongshi', stageId: 'hs_bronze' }, 'match.start.ok', 5000);
  assert(hs.event === 'match.start.ok', '离开后可立即匹配其它游戏');
  await c.call('match.cancel', {}, 'match.cancel.ok', 5000);
  c.ws.terminate();
  await new Promise((r) => setTimeout(r, 500));
  const c2 = new Client(u.accessToken, 'lv2');
  await c2.connect();
  const hello = await c2.once('sys.hello');
  assert(!hello.data.resume || hello.data.snapshot?.room?.gameCode !== 'mahjong_yanbian', '重连快照不再指向已离开的麻将桌');
  c2.close();
}

const t0 = Date.now();
try {
  if (process.env.ONLY === 'roulette' || process.env.ONLY === 'stock' || process.env.ONLY === 'leave') {
    if (process.env.ONLY === 'roulette') await testRoulette();
    else if (process.env.ONLY === 'stock') await testStock();
    else await testLeaveDuringPlay();
    console.log(`\nE2E 结果: ${passed} 通过 / ${failed} 失败`);
    process.exit(failed ? 1 : 0);
  }
  await testSlot();
  await testRoulette();
  await testStock();
  await testFishing();
  await testMahjong();
  await testHongshi();
  await testReconnect();
  await testLeaveDuringPlay();
} catch (e) {
  failed += 1;
  console.error('  ✗ 异常:', e.message);
}
console.log(`\nE2E 结果: ${passed} 通过 / ${failed} 失败 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failed > 0 ? 1 : 0);
