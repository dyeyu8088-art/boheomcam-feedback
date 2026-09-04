// 被动真人（不出任何动作）加入麻将匹配，记录一局内每个阶段的耗时，定位空闲玩家导致的拖慢
import WebSocket from 'ws';
const API = 'http://localhost:8080'; const WS = 'ws://localhost:8090/ws';
const r = await (await fetch(`${API}/api/v1/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guestKey: `probe-${Date.now()}`, deviceId: 'probe-mj', deviceType: 'pc' }) })).json();
const ws = new WebSocket(`${WS}?token=${r.data.accessToken}`);
let seq = 0; const t0 = Date.now(); let mySeat = -1; let lastTurnAt = 0; let lastTurnSeat = -1;
const turnDur = { me: [], other: [] }; let asks = 0; let trusteeEvents = [];
const send = (event, data = {}) => { seq += 1; ws.send(JSON.stringify({ v: 1, event, seq, timestamp: Date.now(), data, requestId: `p-${seq}` })); };
ws.on('open', () => send('match.start', { gameCode: 'mahjong_yanbian', stageId: 'mj_bronze' }));
ws.on('message', (buf) => {
  const m = JSON.parse(buf.toString()); const now = Date.now();
  if (m.event === 'sys.error') console.log('ERR', JSON.stringify(m.data));
  if (m.event === 'room.gameStart' || m.event === 'mahjong.deal') { mySeat = m.data.seat ?? m.data.mySeat ?? mySeat; }
  if (m.event === 'mahjong.deal') { mySeat = m.data.seat ?? mySeat; console.log(`${((now - t0) / 1000).toFixed(1)}s deal mySeat=${mySeat}`); }
  if (m.event === 'mahjong.turn') {
    if (lastTurnAt) (lastTurnSeat === mySeat ? turnDur.me : turnDur.other).push(now - lastTurnAt);
    lastTurnAt = now; lastTurnSeat = m.data.seat;
  }
  if (m.event === 'mahjong.actionAsk') asks += 1;
  if (m.event === 'game.trustee') trusteeEvents.push(`${((now - t0) / 1000).toFixed(1)}s seat${m.data.seat}=${m.data.trustee}(${m.data.reason ?? ''})`);
  if (m.event === 'mahjong.roundEnd') {
    const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length / 1000).toFixed(1) : '-');
    console.log(`${((now - t0) / 1000).toFixed(1)}s roundEnd winners=${JSON.stringify(m.data.result?.winners?.map((w) => w.seat))} draw=${m.data.result?.isDraw}`);
    console.log(`my turns: n=${turnDur.me.length} avg=${avg(turnDur.me)}s max=${(Math.max(0, ...turnDur.me) / 1000).toFixed(1)}s | other turns: n=${turnDur.other.length} avg=${avg(turnDur.other)}s | asks=${asks}`);
    console.log('trustee events:', trusteeEvents.join(' , ') || 'none');
    ws.close(); process.exit(0);
  }
});
setTimeout(() => { console.log('timeout 480s; asks', asks, 'trustee', trusteeEvents.join(','), 'my turns', turnDur.me.map((x) => Math.round(x / 1000)).join(',')); process.exit(1); }, 480000);
