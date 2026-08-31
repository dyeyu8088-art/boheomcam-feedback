/**
 * match-service：按 游戏×场次 排队撮合；等待超时用陪练机器人补位（后台可关）。
 * 机器人不参与钱包结算（结算层排除），仅保证随时开局的体验。
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import { getLogger } from '@yanbian/server-core';
import { hub, type GameSession } from './hub.js';
import { roomManager, Room, type GameHost, type RoomPlayer, type StageConf } from './room.js';
import { loadMahjongRule, loadHongshiRule, loadStages } from './configs.js';
import { mahjongHost } from './hosts/mahjongHost.js';
import { hongshiHost } from './hosts/hongshiHost.js';

const log = getLogger('match');

const BOT_FILL_WAIT_MS = 4000;
const BOT_NAMES = ['金达莱', '海兰江畔', '长白雪松', '图们渔火', '延吉夜风', '珲春晨光', '和龙月色', '敦化松涛'];

interface QueueItem {
  uid: number;
  enqueuedAt: number;
}

const queues = new Map<string, QueueItem[]>();
let botSeq = 0;

function hostOf(gameCode: string): GameHost {
  if (gameCode === 'mahjong_yanbian') return mahjongHost;
  if (gameCode === 'hongshi') return hongshiHost;
  throw new ApiError(ErrorCode.VALIDATION, `不支持匹配的游戏 ${gameCode}`);
}

export async function startMatch(session: GameSession, gameCode: string, stageId: string): Promise<void> {
  if (roomManager.roomOf(session.uid)) throw new ApiError(ErrorCode.ALREADY_IN_ROOM);
  const stages = await loadStages(gameCode);
  const stage = stages.find((s) => s.stageId === stageId);
  if (!stage) throw new ApiError(ErrorCode.NOT_FOUND, '场次不存在');
  const key = `${gameCode}:${stageId}`;
  let q = queues.get(key);
  if (!q) {
    q = [];
    queues.set(key, q);
  }
  if (q.some((x) => x.uid === session.uid)) return;
  q.push({ uid: session.uid, enqueuedAt: Date.now() });
  hub.send(session.uid, 'match.queued', { gameCode, stageId, position: q.length });
}

export function cancelMatch(uid: number): void {
  for (const q of queues.values()) {
    const idx = q.findIndex((x) => x.uid === uid);
    if (idx >= 0) q.splice(idx, 1);
  }
  hub.send(uid, Ev.MatchCancel, {});
}

export function makeBot(seat: number): RoomPlayer {
  botSeq += 1;
  return {
    uid: 900000000 + botSeq,
    seat,
    nickname: BOT_NAMES[botSeq % BOT_NAMES.length]!,
    avatarId: (botSeq % 12) + 1,
    vip: 0,
    ready: true,
    online: true,
    trustee: false,
    score: 0,
    isBot: true,
    coins: 0,
  };
}

async function tryAssemble(key: string): Promise<void> {
  const q = queues.get(key);
  if (!q || q.length === 0) return;
  const [gameCode, stageId] = key.split(':') as [string, string];
  const stages = await loadStages(gameCode);
  const stage = stages.find((s) => s.stageId === stageId);
  if (!stage) return;
  const need = 4;
  const now = Date.now();
  const oldest = q[0]!.enqueuedAt;
  const humans = q.length >= need ? q.splice(0, need) : now - oldest >= BOT_FILL_WAIT_MS ? q.splice(0, q.length) : null;
  if (!humans || humans.length === 0) return;

  const rule = gameCode === 'mahjong_yanbian' ? await loadMahjongRule() : await loadHongshiRule();
  const room = new Room({
    gameCode,
    stage,
    mode: 'match',
    ownerUid: null,
    maxPlayers: need,
    totalRounds: stage.totalRounds,
    ruleVersion: rule.ruleVersion,
    host: hostOf(gameCode),
  });
  roomManager.register(room);
  await roomManager.persistCreate(room, { ruleVersion: rule.ruleVersion, stage });

  const joined: number[] = [];
  for (const h of humans) {
    const s = hub.get(h.uid);
    if (!s) continue;
    try {
      await roomManager.addPlayer(room, s);
      joined.push(h.uid);
    } catch (e) {
      hub.send(h.uid, 'sys.error', { code: (e as ApiError).code ?? ErrorCode.INTERNAL, msg: (e as Error).message, event: Ev.MatchStart });
    }
  }
  if (joined.length === 0) {
    await roomManager.destroyRoom(room, 'empty');
    return;
  }
  while (room.players.length < need) {
    const used = new Set(room.players.map((p) => p.seat));
    let seat = 0;
    while (used.has(seat)) seat += 1;
    room.players.push(makeBot(seat));
  }
  room.players.sort((a, b) => a.seat - b.seat);
  for (const uid of joined) {
    hub.send(uid, Ev.MatchFound, { room: room.info() });
  }
  log.info({ roomId: room.roomId, gameCode, humans: joined.length }, 'match assembled');
  setTimeout(() => {
    if (roomManager.rooms.has(room.roomId)) room.host.start(room);
  }, 1500);
}

export function startMatchLoop(): NodeJS.Timeout {
  const t = setInterval(() => {
    for (const key of queues.keys()) {
      void tryAssemble(key).catch((e) => log.error({ err: (e as Error).message }, 'assemble failed'));
    }
  }, 1000);
  t.unref();
  return t;
}
