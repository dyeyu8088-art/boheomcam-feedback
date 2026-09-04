/**
 * 桌面游戏（麻将/红十）通用房间会话：连接→匹配/建房/加房→房间状态→重连快照→离开。
 */
import { onBeforeUnmount, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Ev } from '@yanbian/protocol';
import { gameSocket } from '../net/ws.js';
import { toast } from '../ui/toast.js';
import { t } from '../i18n/index.js';

export interface RoomPlayerView {
  uid: number;
  seat: number;
  nickname: string;
  avatarId: number;
  vip: number;
  ready: boolean;
  online: boolean;
  trustee: boolean;
  score: number;
  /** 对局中离开（本局托管打完，局末由机器人接替） */
  left?: boolean;
}

export interface RoomView {
  roomId: string;
  roomNo: string;
  gameCode: string;
  baseScore: number;
  mode: string;
  ownerUid: number | null;
  maxPlayers: number;
  totalRounds: number;
  currentRound: number;
  state: string;
  players: RoomPlayerView[];
}

export function useGameRoom(gameCode: 'mahjong_yanbian' | 'hongshi') {
  const route = useRoute();
  const router = useRouter();
  const room = ref<RoomView | null>(null);
  const phase = ref<'connecting' | 'matching' | 'waiting' | 'playing' | 'over'>('connecting');
  const mySeat = ref(-1);
  const myUid = ref(0);
  const offs: (() => void)[] = [];
  const state = reactive({ snapshotGame: null as Record<string, unknown> | null });
  /** 对局中点退出：先确认（本局托管打完并照常结算） */
  const showLeave = ref(false);

  function on(event: string, handler: (data: any, full?: any) => void): void {
    offs.push(gameSocket.on(event, (m) => handler(m.data, m)));
  }

  function applyRoom(r: RoomView): void {
    room.value = r;
    const me = r.players.find((p) => p.uid === myUid.value);
    if (me) mySeat.value = me.seat;
    phase.value = r.state === 'waiting' ? 'waiting' : 'playing';
  }

  async function begin(uid: number): Promise<Record<string, unknown> | null> {
    myUid.value = uid;
    if (gameSocket.status !== 'open') await gameSocket.connect();

    // 通用房间事件
    on(Ev.RoomPlayerJoined, () => void refreshFromServer());
    on(Ev.RoomPlayerLeft, (d) => {
      if (room.value) room.value.players = room.value.players.filter((p) => p.uid !== d.uid);
    });
    on(Ev.RoomPlayerReady, (d) => {
      const p = room.value?.players.find((x) => x.seat === d.seat);
      if (p) p.ready = d.ready;
    });
    on(Ev.RoomPlayerOffline, (d) => {
      const p = room.value?.players.find((x) => x.seat === d.seat);
      if (p) p.online = false;
    });
    on(Ev.RoomPlayerReconnect, (d) => {
      const p = room.value?.players.find((x) => x.seat === d.seat);
      if (p) {
        p.online = true;
        p.trustee = false;
      }
    });
    on(Ev.GameTrustee, (d) => {
      const p = room.value?.players.find((x) => x.seat === d.seat);
      if (p) {
        p.trustee = d.trustee;
        if (d.reason === 'leave') p.left = true;
      }
    });
    on(Ev.RoomDissolve, () => {
      toast(t('room.dissolve'), 'info');
      void leaveToLobby(false);
    });
    on(Ev.SysKicked, () => {
      toast(t('net.kicked'), 'error');
      void router.replace('/login');
    });
    on(Ev.MatchFound, (d) => applyRoom(d.room as RoomView));
    on('local.resyncNeeded', () => void refreshFromServer());

    const mode = String(route.query.mode ?? 'match');
    try {
      // 优先处理断线恢复（服务端 hello 快照）
      const resync = await gameSocket.call<{ snapshot: Record<string, unknown> | null }>('sys.resync');
      if (resync.snapshot && (resync.snapshot as { room?: RoomView }).room) {
        const snap = resync.snapshot as { room: RoomView; game?: Record<string, unknown>; mySeat: number };
        // 仍在另一种游戏的牌桌上：不能把那桌的快照套进本视图，直接带回那桌
        if (snap.room.gameCode !== gameCode) {
          toast(t('room.otherTable'), 'info');
          void router.replace(snap.room.gameCode === 'hongshi' ? '/game/hongshi' : '/game/mahjong');
          return null;
        }
        applyRoom(snap.room);
        mySeat.value = snap.mySeat;
        state.snapshotGame = snap.game ?? null;
        return resync.snapshot;
      }
      if (mode === 'match') {
        phase.value = 'matching';
        await gameSocket.call('match.start', { gameCode, stageId: String(route.query.stageId ?? '') });
      } else if (mode === 'create') {
        const r = await gameSocket.call<{ room: RoomView }>('room.create', {
          gameCode,
          baseScore: Number(route.query.baseScore ?? 10),
          totalRounds: Number(route.query.totalRounds ?? 4),
          password: route.query.password ? String(route.query.password) : undefined,
        });
        applyRoom(r.room);
      } else if (mode === 'join') {
        const r = await gameSocket.call<{ room: RoomView }>('room.join', {
          roomNo: String(route.query.roomNo ?? ''),
          password: route.query.password ? String(route.query.password) : undefined,
        });
        applyRoom(r.room);
      }
    } catch (e) {
      const err = e as Error & { code?: number };
      toast(err.code ? t(`error.${codeName(err.code)}`) : err.message, 'error');
      void router.replace('/lobby');
    }
    return null;
  }

  async function refreshFromServer(): Promise<void> {
    try {
      const r = await gameSocket.call<{ snapshot: { room?: RoomView } | null }>('sys.resync');
      if (r.snapshot?.room) applyRoom(r.snapshot.room);
    } catch {
      /* noop */
    }
  }

  function ready(on_: boolean): void {
    void gameSocket.call(on_ ? 'room.ready' : 'room.unready').catch(() => undefined);
    const me = room.value?.players.find((p) => p.uid === myUid.value);
    if (me) me.ready = on_;
  }

  async function leaveToLobby(callServer = true): Promise<void> {
    showLeave.value = false;
    if (callServer) await gameSocket.call('room.leave').catch(() => undefined);
    void router.replace('/lobby');
  }

  /** 退出按钮：对局中先弹确认，其它阶段直接离开 */
  function askLeave(): void {
    if (phase.value === 'playing' && room.value?.state !== 'waiting') showLeave.value = true;
    else void leaveToLobby();
  }

  function cancelMatch(): void {
    void gameSocket.call('match.cancel').catch(() => undefined);
    void router.replace('/lobby');
  }

  onBeforeUnmount(() => {
    for (const off of offs) off();
  });

  return { room, phase, mySeat, myUid, state, showLeave, on, begin, ready, leaveToLobby, askLeave, cancelMatch, refreshFromServer };
}

function codeName(code: number): string {
  const map: Record<number, string> = {
    3000: 'INSUFFICIENT_BALANCE',
    4007: 'MIN_BALANCE_REQUIRED',
    4000: 'ROOM_NOT_FOUND',
  };
  return map[code] ?? 'generic';
}

/** 相对座位换算：把绝对 seat 转为以自己为下方(0)的视角位置 0=下 1=右 2=上 3=左 */
export function relativePos(seat: number, mySeat: number, totalSeats = 4): number {
  return (seat - mySeat + totalSeats) % totalSeats;
}
