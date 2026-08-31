<template>
  <div class="mj-root">
    <!-- 匹配/等待 覆盖层 -->
    <div v-if="phase === 'connecting' || phase === 'matching'" class="overlay">
      <div class="radar"><span /><span /><span /></div>
      <div class="otext">{{ phase === 'matching' ? t('lobby.matching') : t('common.loading') }}</div>
      <button v-if="phase === 'matching'" class="btn btn-secondary" @click="cancelMatch">{{ t('lobby.match.cancel') }}</button>
    </div>

    <!-- 等待开局 -->
    <div v-else-if="phase === 'waiting'" class="overlay">
      <div class="wait-card glass">
        <div class="wtitle">{{ t('game.mahjong_yanbian') }}</div>
        <div class="wno num" @click="copyRoomNo">{{ t('room.no', { no: room?.roomNo ?? '' }) }} ⧉</div>
        <div class="wplayers">
          <div v-for="p in room?.players ?? []" :key="p.uid" class="wp">
            <AvatarBadge :id="p.avatarId" :size="34" />
            <div class="wname">{{ p.nickname }}</div>
            <div class="wready" :class="{ on: p.ready }">{{ p.ready ? '✓' : '…' }}</div>
          </div>
          <div v-for="n in 4 - (room?.players.length ?? 0)" :key="`e${n}`" class="wp empty-seat">
            <div class="wavatar">?</div>
            <div class="wname">{{ t('room.waiting') }}</div>
          </div>
        </div>
        <div class="wbtns">
          <button class="btn btn-primary" style="flex: 1" @click="toggleReady">
            {{ meReady ? t('room.cancelReady') : t('room.ready') }}
          </button>
          <button class="btn btn-secondary" @click="leaveToLobby()">{{ t('room.leave') }}</button>
        </div>
      </div>
    </div>

    <!-- 牌桌 -->
    <template v-else>
      <TableSurface tone="emerald" />
      <!-- 顶部信息 -->
      <div class="hud-top">
        <button class="hback" @click="leaveToLobby()"><AppIcon name="back" :size="18" /></button>
        <div class="hinfo">
          <span class="num">{{ t('room.round', { a: room?.currentRound ?? 1, b: room?.totalRounds ?? 4 }) }}</span>
          <span class="sep">·</span>
          <span class="num">{{ t('mj.wallLeft', { n: wallLeft }) }}</span>
        </div>
        <div class="hcoins num"><AppIcon name="coin" :size="15" />{{ fmt(user.me?.coins) }}</div>
      </div>

      <!-- 对家/上下家 -->
      <div v-for="p in others" :key="p.uid" class="opp" :class="`pos${p.pos}`">
        <div class="opp-head" :class="{ active: turnSeat === p.seat, off: !p.online }">
          <div class="oavatar"><AvatarBadge :id="p.avatarId" :size="30" /><span v-if="p.seat === dealerSeat" class="dealer">{{ t('mj.dealer') }}</span></div>
          <span class="wind-badge">{{ windOfSeat(p.seat) }}</span>
          <div class="oname">{{ p.nickname }}</div>
          <div class="ocount num">×{{ p.handCount }}</div>
          <div class="oscore num">{{ p.score }}</div>
          <CountdownRing v-if="turnSeat === p.seat" :deadline="deadlineAt" />
          <span v-if="p.trustee" class="tflag">{{ t('room.trustee') }}</span>
        </div>
        <div class="opp-hand">
          <MjTile v-for="n in p.handCount" :key="n" back size="xs" />
        </div>
        <div class="opp-melds">
          <div v-for="(m, i) in p.melds" :key="i" class="meld">
            <MjTile v-for="(k, j) in m.kinds" :key="j" :kind="k" size="xs" :back="m.type === 'angang' && j < 3" />
          </div>
        </div>
      </div>

      <!-- 中央：弃牌河 -->
      <div class="river-zone">
        <div v-for="p in allPlayers" :key="p.seat" class="river" :class="`rpos${relPos(p.seat)}`">
          <MjTile
            v-for="(tile, i) in p.discards"
            :key="i"
            :kind="kindOf(tile)"
            size="sm"
            :class="{ latest: lastDiscard && lastDiscard.seat === p.seat && i === p.discards.length - 1 }"
          />
        </div>
        <!-- 中央罗盘：四门风 + 余牌数 + 当前出牌方指针 -->
        <div class="center-disc">
          <svg class="cmp" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="cmpGold" x1="0.1" y1="0" x2="0.7" y2="1">
                <stop offset="0" stop-color="#f6e6bd" />
                <stop offset="0.5" stop-color="#c9a063" />
                <stop offset="1" stop-color="#7d5f2c" />
              </linearGradient>
              <radialGradient id="cmpPlate" cx="0.36" cy="0.28" r="0.85">
                <stop offset="0" stop-color="#17422f" />
                <stop offset="0.6" stop-color="#0c2a1e" />
                <stop offset="1" stop-color="#061510" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="53" fill="url(#cmpPlate)" />
            <circle cx="60" cy="60" r="53" fill="none" stroke="url(#cmpGold)" stroke-width="1.4" stroke-opacity="0.55" />
            <circle cx="60" cy="60" r="46" fill="none" stroke="url(#cmpGold)" stroke-width="0.8" stroke-opacity="0.26" />
            <!-- 朝鲜族菱格 -->
            <path d="M60 24 L96 60 L60 96 L24 60 z" fill="none" stroke="url(#cmpGold)" stroke-width="0.9" stroke-opacity="0.24" />
            <!-- 长白山双峰纹章 -->
            <path d="M38 76 L52 54 L60 63 L70 46 L82 76 z" fill="url(#cmpGold)" opacity="0.16" />
            <circle cx="70" cy="40" r="3.4" fill="url(#cmpGold)" opacity="0.2" />
          </svg>
          <span class="cmp-wind wn">{{ windAt(2) }}</span>
          <span class="cmp-wind we">{{ windAt(1) }}</span>
          <span class="cmp-wind ws">{{ windAt(0) }}</span>
          <span class="cmp-wind ww">{{ windAt(3) }}</span>
          <span class="cmp-left num">{{ wallLeft }}</span>
          <span class="cmp-left-cap">{{ t('mj.wallUnit') }}</span>
          <svg class="cmp-arrow" viewBox="0 0 120 120" :style="{ transform: `rotate(${arrowDeg}deg)` }">
            <path d="M60 6 L67.5 22 L60 17.5 L52.5 22 z" fill="url(#cmpGold)" />
          </svg>
        </div>
      </div>

      <!-- 自己区域 -->
      <div class="my-zone">
        <div class="my-head" :class="{ active: turnSeat === mySeat }">
          <div class="mavatar"><AvatarBadge :id="me?.avatarId ?? 1" :size="34" /><span v-if="mySeat === dealerSeat" class="dealer">{{ t('mj.dealer') }}</span></div>
          <span class="wind-badge lg">{{ windOfSeat(mySeat) }}</span>
          <div class="mscore num">{{ myPlayer?.score ?? 0 }}</div>
          <CountdownRing v-if="turnSeat === mySeat" :deadline="deadlineAt" />
        </div>
        <div class="my-melds">
          <div v-for="(m, i) in myMelds" :key="i" class="meld">
            <MjTile v-for="(k, j) in m.kinds" :key="j" :kind="k" size="sm" :back="m.type === 'angang' && j < 3" />
          </div>
        </div>
        <div class="my-hand">
          <MjTile
            v-for="tile in handSorted"
            :key="tile"
            :kind="kindOf(tile)"
            size="md"
            class="htile"
            :selected="selectedTile === tile"
            @click="tapTile(tile)"
          />
          <div v-if="drawnTile !== null" class="drawn-gap" />
          <MjTile
            v-if="drawnTile !== null"
            :kind="kindOf(drawnTile)"
            size="md"
            class="htile drawn"
            :selected="selectedTile === drawnTile"
            @click="tapTile(drawnTile)"
          />
        </div>
      </div>

      <!-- 动作按钮 -->
      <transition name="pop">
        <div v-if="actionOptions.length > 0" class="action-bar">
          <button
            v-for="a in actionOptions"
            :key="a.action"
            class="act"
            :class="a.action"
            @click="doAction(a)"
          >
            {{ t(`mj.${a.action === 'pass' ? 'pass' : a.action}`) }}
          </button>
        </div>
      </transition>

      <!-- 托管提示 -->
      <div v-if="myPlayer?.trustee" class="trustee-bar glass" @click="cancelTrustee">
        {{ t('room.trustee') }} — {{ t('room.trustee.cancel') }}
      </div>

      <!-- 聊天 -->
      <button class="chat-btn glass" @click="showChat = !showChat"><AppIcon name="chat" :size="18" /></button>
      <transition name="pop">
        <div v-if="showChat" class="chat-panel glass">
          <button v-for="n in 6" :key="n" class="chat-q" @click="sendQuick(n - 1)">{{ t(`room.chat.q${n - 1}`) }}</button>
        </div>
      </transition>
      <transition-group name="toast" tag="div" class="chat-bubbles">
        <div v-for="b in chatBubbles" :key="b.id" class="bubble glass">{{ b.text }}</div>
      </transition-group>

      <!-- 单局结算 -->
      <ModalSheet v-model="showSettle" :title="t('mj.settle.title')" width="480px">
        <div v-if="roundResult" class="settle">
          <div v-if="roundResult.isDraw" class="sdraw">{{ t('mj.liuju') }}</div>
          <div v-for="w in roundResult.winners" :key="w.seat" class="swin">
            <span class="swho">{{ nameOf(w.seat) }}</span>
            <span class="show">{{ w.selfDraw ? t('mj.zimo') : t('mj.hu') }} · {{ t('mj.fan', { n: w.fan }) }}</span>
            <span class="spat">{{ w.patterns.map((p: any) => p.id).join(' / ') }}</span>
          </div>
          <div class="srows">
            <div v-for="p in allPlayers" :key="p.seat" class="srow">
              <span>{{ nameOf(p.seat) }}</span>
              <span class="num" :class="scoreOf(p.seat) > 0 ? 'win' : scoreOf(p.seat) < 0 ? 'lose' : ''">
                {{ fmtSigned(scoreOf(p.seat)) }}
              </span>
            </div>
          </div>
          <div class="snext">{{ t('mj.settle.next') }}</div>
        </div>
      </ModalSheet>

      <!-- 总结算 -->
      <ModalSheet v-model="showMatchOver" :title="t('mj.matchOver')" width="480px">
        <div class="srows">
          <div v-for="row in matchTotals" :key="row.seat" class="srow">
            <span>{{ row.nickname }}</span>
            <span class="num" :class="row.score > 0 ? 'win' : row.score < 0 ? 'lose' : ''">{{ fmtSigned(row.score) }}</span>
          </div>
        </div>
        <button class="btn btn-primary" style="width: 100%; margin-top: 16px" @click="leaveToLobby(false)">
          {{ t('common.back') }}
        </button>
      </ModalSheet>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Ev } from '@yanbian/protocol';
import { gameSocket } from '../../net/ws.js';
import { useUserStore } from '../../stores/user.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import ModalSheet from '../../ui/ModalSheet.vue';
import CountdownRing from '../CountdownRing.vue';
import MjTile from './MjTile.vue';
import TableSurface from '../TableSurface.vue';
import { useGameRoom, relativePos } from '../useGameRoom.js';
import AvatarBadge from '../../ui/AvatarBadge.vue';
import AppIcon from '../../ui/AppIcon.vue';
import { fmt, fmtSigned } from '../../ui/format.js';

const user = useUserStore();
const me = computed(() => user.me);
const { room, phase, mySeat, state, on, begin, ready, leaveToLobby, cancelMatch } = useGameRoom('mahjong_yanbian');

const kindOf = (tile: number): number => Math.floor(tile / 4);

interface OppState {
  seat: number;
  handCount: number;
  melds: { type: string; kinds: number[] }[];
  discards: number[];
}

const myHand = ref<number[]>([]);
const drawnTile = ref<number | null>(null);
const selectedTile = ref<number | null>(null);
const seatStates = ref(new Map<number, OppState>());
const turnSeat = ref(-1);
const dealerSeat = ref(-1);
const wallLeft = ref(0);
const deadlineAt = ref(0);
const lastDiscard = ref<{ seat: number; tile: number } | null>(null);
const actionOptions = ref<{ action: string; kinds?: number[]; variants?: number[][]; gtype?: string; kind?: number }[]>([]);
const showChat = ref(false);
const chatBubbles = ref<{ id: number; text: string }[]>([]);
const showSettle = ref(false);
const roundResult = ref<any>(null);
const showMatchOver = ref(false);
const matchTotals = ref<{ seat: number; nickname: string; score: number }[]>([]);
let bubbleSeq = 0;

const allPlayers = computed(() =>
  (room.value?.players ?? []).map((p) => ({
    ...p,
    ...(seatStates.value.get(p.seat) ?? { handCount: 13, melds: [], discards: [] }),
  })),
);
const others = computed(() =>
  allPlayers.value
    .filter((p) => p.seat !== mySeat.value)
    .map((p) => ({ ...p, pos: relativePos(p.seat, mySeat.value) })),
);
const myPlayer = computed(() => allPlayers.value.find((p) => p.seat === mySeat.value));
const myMelds = computed(() => seatStates.value.get(mySeat.value)?.melds ?? []);
const meReady = computed(() => room.value?.players.find((p) => p.seat === mySeat.value)?.ready ?? false);
const handSorted = computed(() => {
  const rest = drawnTile.value !== null ? myHand.value.filter((x) => x !== drawnTile.value) : [...myHand.value];
  return rest.sort((a, b) => a - b);
});
const relPos = (seat: number): number => relativePos(seat, mySeat.value);
const arrowDeg = computed(() => [180, 90, 0, 270][relPos(turnSeat.value)] ?? 0);

/** 门风：庄家为東，逆时针 南→西→北 */
const WINDS = ['東', '南', '西', '北'];
function windOfSeat(seat: number): string {
  if (dealerSeat.value < 0 || seat < 0) return '';
  return WINDS[(seat - dealerSeat.value + 4) % 4] ?? '';
}
/** 罗盘四向：0=自己(下) 1=右 2=对(上) 3=左 */
function windAt(pos: number): string {
  const p = allPlayers.value.find((x) => relPos(x.seat) === pos);
  return p ? windOfSeat(p.seat) : '';
}
const nameOf = (seat: number): string => room.value?.players.find((p) => p.seat === seat)?.nickname ?? `#${seat}`;
const scoreOf = (seat: number): number => (roundResult.value?.scoreChanges?.[seat] as number) ?? 0;

function ensureSeat(seat: number): OppState {
  let s = seatStates.value.get(seat);
  if (!s) {
    s = { seat, handCount: 13, melds: [], discards: [] };
    seatStates.value.set(seat, s);
  }
  return s;
}

function resetRound(): void {
  myHand.value = [];
  drawnTile.value = null;
  selectedTile.value = null;
  seatStates.value = new Map();
  lastDiscard.value = null;
  actionOptions.value = [];
  roundResult.value = null;
  showSettle.value = false;
}

function applySnapshot(game: any): void {
  if (!game) return;
  resetRound();
  myHand.value = [...(game.myHand ?? [])];
  drawnTile.value = game.myDrawn ?? null;
  turnSeat.value = game.turnSeat ?? -1;
  dealerSeat.value = game.dealerSeat ?? -1;
  wallLeft.value = game.wallLeft ?? 0;
  lastDiscard.value = game.lastDiscard ?? null;
  for (const p of game.players ?? []) {
    seatStates.value.set(p.seat, { seat: p.seat, handCount: p.handCount, melds: p.melds ?? [], discards: p.discards ?? [] });
  }
  if (game.myPendingClaim) {
    actionOptions.value = normalizeOptions(game.myPendingClaim);
  }
  deadlineAt.value = Date.now() + 10000;
}

function normalizeOptions(options: any[]): typeof actionOptions.value {
  const out: typeof actionOptions.value = [];
  for (const o of options) {
    if (o.action === 'chi' && o.variants) {
      for (const v of o.variants) out.push({ action: 'chi', kinds: v });
    } else {
      out.push({ action: o.action });
    }
  }
  out.push({ action: 'pass' });
  return out;
}

onMounted(async () => {
  const snap = await begin(user.me?.uid ?? 0);
  if (snap && (snap as any).game) applySnapshot((snap as any).game);

  on(Ev.RoomGameStart, (d) => {
    resetRound();
    dealerSeat.value = d.dealerSeat ?? dealerSeat.value;
    if (room.value) room.value.currentRound = d.currentRound;
    phase.value = 'playing';
  });
  on(Ev.MjDeal, (d) => {
    resetRound();
    myHand.value = [...d.tiles];
    dealerSeat.value = d.dealerSeat;
    for (const p of room.value?.players ?? []) ensureSeat(p.seat).handCount = p.seat === d.dealerSeat ? 14 : 13;
  });
  on(Ev.MjDraw, (d) => {
    myHand.value.push(d.tile);
    drawnTile.value = d.tile;
    wallLeft.value = d.wallLeft;
    ensureSeat(mySeat.value).handCount = myHand.value.length;
    // 自摸/暗杠/报听 选项查询
    void gameSocket.call('mahjong.options', {}, 4000).catch(() => undefined);
  });
  on('mahjong.options', (d) => {
    const opts: typeof actionOptions.value = [];
    if (d.canHu) opts.push({ action: 'hu' });
    for (const k of d.anGangKinds ?? []) opts.push({ action: 'gang', gtype: 'angang', kind: k });
    for (const k of d.buGangKinds ?? []) opts.push({ action: 'gang', gtype: 'bugang', kind: k });
    if (opts.length > 0) {
      opts.push({ action: 'pass' });
      actionOptions.value = opts;
    }
  });
  on(Ev.MjDrawPublic, (d) => {
    wallLeft.value = d.wallLeft;
    const s = ensureSeat(d.seat);
    s.handCount += 1;
  });
  on(Ev.MjTurn, (d) => {
    turnSeat.value = d.seat;
    wallLeft.value = d.wallLeft ?? wallLeft.value;
    deadlineAt.value = d.deadlineAt ?? Date.now() + 15000;
    // 回合推进即关闭旧动作窗口（新的 actionAsk 会重新弹出）
    if (d.seat !== mySeat.value) actionOptions.value = [];
  });
  on(Ev.MjDiscarded, (d) => {
    const s = ensureSeat(d.seat);
    s.discards.push(d.tile);
    s.handCount -= d.seat === mySeat.value ? 0 : 1;
    if (d.seat === mySeat.value) {
      myHand.value = myHand.value.filter((x) => x !== d.tile);
      drawnTile.value = null;
      selectedTile.value = null;
      ensureSeat(mySeat.value).handCount = myHand.value.length;
      actionOptions.value = [];
    }
    lastDiscard.value = { seat: d.seat, tile: d.tile };
  });
  on(Ev.MjActionAsk, (d) => {
    actionOptions.value = normalizeOptions(d.options ?? []);
  });
  on(Ev.MjMeld, (d) => {
    const s = ensureSeat(d.seat);
    if (d.type === 'bugang') {
      const meld = s.melds.find((m) => m.type === 'peng' && m.kinds[0] === d.kind);
      if (meld) {
        meld.type = 'bugang';
        meld.kinds = [d.kind, d.kind, d.kind, d.kind];
      }
    } else {
      const kinds = d.kinds ?? (d.type === 'peng' ? [d.kind, d.kind, d.kind] : [d.kind, d.kind, d.kind, d.kind]);
      s.melds.push({ type: d.type, kinds });
    }
    // 从手牌区扣数：吃碰用2/杠看类型
    if (d.seat === mySeat.value) {
      // 服务器状态已变，重新用 resync 拉手牌保证一致
      void gameSocket.call('sys.resync').then((r: any) => {
        const g = r.snapshot?.game;
        if (g) {
          myHand.value = [...g.myHand];
          drawnTile.value = g.myDrawn ?? null;
        }
      });
      actionOptions.value = [];
    } else {
      const used = d.type === 'angang' ? 4 : d.type === 'minggang' ? 3 : d.type === 'bugang' ? 1 : 2;
      s.handCount = Math.max(0, s.handCount - used);
    }
    if (d.fromSeat !== undefined && d.type !== 'angang' && d.type !== 'bugang') {
      const from = ensureSeat(d.fromSeat);
      from.discards.pop();
    }
  });
  on(Ev.MjRoundEnd, (d) => {
    roundResult.value = d.result;
    // 亮牌
    for (const h of d.hands ?? []) {
      const s = ensureSeat(h.seat);
      if (h.seat !== mySeat.value) {
        s.discards = s.discards; // 保持
      }
    }
    actionOptions.value = [];
    showSettle.value = true;
    if (typeof d.balances !== 'undefined') {
      const mine = (d.balances as { userId: number; balance: number }[]).find((b) => b.userId === user.me?.uid);
      if (mine) user.setBalance(mine.balance);
    }
    if (room.value) {
      for (const tot of d.totals ?? []) {
        const p = room.value.players.find((x) => x.seat === tot.seat);
        if (p) p.score = tot.score;
      }
    }
    setTimeout(() => {
      showSettle.value = false;
    }, 5200);
  });
  on(Ev.GameMatchOver, (d) => {
    matchTotals.value = d.totals ?? [];
    showSettle.value = false;
    showMatchOver.value = true;
  });
  on(Ev.RoomChat, (d) => {
    const text = d.quickId !== undefined ? t(`room.chat.q${d.quickId}`) : (d.text ?? '');
    bubbleSeq += 1;
    const id = bubbleSeq;
    chatBubbles.value.push({ id, text: `${nameOf(d.seat)}: ${text}` });
    setTimeout(() => {
      chatBubbles.value = chatBubbles.value.filter((b) => b.id !== id);
    }, 3000);
  });
});

function toggleReady(): void {
  ready(!meReady.value);
}

function tapTile(tile: number): void {
  if (turnSeat.value !== mySeat.value) return;
  if (selectedTile.value === tile) {
    void gameSocket.call('mahjong.discard', { tile }).catch((e) => toast((e as Error).message, 'error'));
    selectedTile.value = null;
  } else {
    selectedTile.value = tile;
  }
}

function doAction(a: (typeof actionOptions.value)[number]): void {
  actionOptions.value = [];
  if (a.gtype) {
    void gameSocket.call('mahjong.action', { action: 'gang', gtype: a.gtype, kind: a.kind }).catch((e) => toast((e as Error).message, 'error'));
    return;
  }
  if (a.action === 'hu' && turnSeat.value === mySeat.value && drawnTile.value !== null) {
    void gameSocket.call('mahjong.action', { action: 'hu' }).catch((e) => toast((e as Error).message, 'error'));
    return;
  }
  void gameSocket
    .call('mahjong.action', { action: a.action, kinds: a.kinds })
    .catch((e) => toast((e as Error).message, 'error'));
}

function cancelTrustee(): void {
  void gameSocket.call('game.trustee', { on: false }).catch(() => undefined);
}

function sendQuick(id: number): void {
  showChat.value = false;
  gameSocket.send(Ev.RoomChat, { quickId: id });
}

function copyRoomNo(): void {
  void navigator.clipboard?.writeText(room.value?.roomNo ?? '').then(() => toast(t('common.copied'), 'success'));
}
</script>

<style scoped>
.mj-root {
  height: 100%;
  position: relative;
  overflow: hidden;
  /* 房间环境：牌桌之外的深色空间，让台面“浮”起来 */
  background: radial-gradient(120% 100% at 50% 30%, #10261c 0%, #0a1a13 48%, #05100c 100%);
}
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: radial-gradient(120% 100% at 50% 0%, #131a28 0%, var(--bg-abyss) 70%);
  z-index: 10;
}
.radar {
  position: relative;
  width: 90px;
  height: 90px;
}
.radar span {
  position: absolute;
  inset: 0;
  border: 2px solid var(--gold-warm);
  border-radius: 50%;
  animation: radar 2s ease-out infinite;
  opacity: 0;
}
.radar span:nth-child(2) {
  animation-delay: 0.6s;
}
.radar span:nth-child(3) {
  animation-delay: 1.2s;
}
@keyframes radar {
  0% {
    transform: scale(0.3);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.15);
    opacity: 0;
  }
}
.otext {
  color: var(--gold-champagne);
  letter-spacing: 0.2em;
}
.wait-card {
  width: min(520px, 92vw);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.wtitle {
  font-size: 18px;
  font-weight: 800;
  color: var(--gold-champagne);
  text-align: center;
}
.wno {
  text-align: center;
  color: var(--text-secondary);
  cursor: pointer;
}
.wplayers {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.wp {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  background: var(--bg-night);
  border-radius: 12px;
  border: 1px solid rgba(154, 163, 178, 0.1);
}
.wp.empty-seat {
  opacity: 0.4;
}
.wavatar-unused {
  font-size: 28px;
}
.wname {
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wready {
  font-size: 12px;
  color: var(--text-disabled);
}
.wready.on {
  color: var(--accent-jade);
}
.wbtns {
  display: flex;
  gap: 10px;
}

.hud-top {
  position: absolute;
  top: calc(var(--safe-top) + 8px);
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 5;
}
.hback {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--line-soft);
  color: var(--gold-champagne);
  font-size: 20px;
  cursor: pointer;
}
.hinfo {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  padding: 6px 16px;
  font-size: 12px;
  color: var(--gold-champagne);
}
.sep {
  margin: 0 8px;
  opacity: 0.5;
}
.hcoins {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--gold-warm);
}

.opp {
  position: absolute;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opp.pos2 {
  top: calc(var(--safe-top) + 58px);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.opp.pos1 {
  right: max(var(--safe-right), 6.5%);
  top: 50%;
  transform: translateY(-66%);
  align-items: flex-end;
}
.opp.pos3 {
  left: max(var(--safe-left), 6.5%);
  top: 50%;
  transform: translateY(-66%);
  align-items: flex-start;
}
.opp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(160deg, rgba(16, 32, 25, 0.88), rgba(6, 15, 11, 0.8));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(201, 160, 99, 0.18);
  border-radius: 999px;
  padding: 5px 14px 5px 5px;
  position: relative;
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.1),
    inset 0 -8px 16px rgba(0, 0, 0, 0.34),
    0 8px 20px rgba(0, 0, 0, 0.45);
  transition:
    border-color 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out);
}
.opp-head.active {
  border-color: rgba(201, 160, 99, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.16),
    inset 0 -8px 16px rgba(0, 0, 0, 0.34),
    0 8px 20px rgba(0, 0, 0, 0.45),
    0 0 20px rgba(201, 160, 99, 0.34);
}
/* 门风徽章：金属方章 */
.wind-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
  color: #241a08;
  background: linear-gradient(180deg, #f6e6bd, #c9a063 62%, #9a7940);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.45);
}
.wind-badge.lg {
  width: 23px;
  height: 23px;
  border-radius: 7px;
  font-size: 13px;
}
.wind-badge:empty {
  display: none;
}
.opp-head.off {
  opacity: 0.55;
}
.oavatar {
  font-size: 22px;
  position: relative;
}
.dealer {
  position: absolute;
  top: -6px;
  right: -10px;
  background: var(--gold-warm);
  color: #14100a;
  font-size: 9px;
  font-weight: 800;
  border-radius: 6px;
  padding: 0 4px;
}
.oname {
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oscore {
  font-size: 12px;
  color: var(--gold-champagne);
  font-weight: 700;
}
.ocount {
  font-size: 11px;
  color: var(--text-disabled);
}
.tflag {
  font-size: 9px;
  color: var(--accent-jade);
}
.opp-hand {
  display: flex;
  gap: 2px;
}
.pos1 .opp-hand,
.pos3 .opp-hand {
  flex-direction: column;
}
.opp-melds {
  display: flex;
  gap: 6px;
}
.meld {
  display: flex;
  gap: 1px;
}

.river-zone {
  position: absolute;
  inset: 29% 30% 33%;
  z-index: 2;
}
.river {
  position: absolute;
  display: grid;
  grid-template-columns: repeat(9, auto);
  gap: 2px;
  justify-content: center;
}
.river.rpos0 {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}
.river.rpos2 {
  top: 0;
  left: 50%;
  transform: translateX(-50%) rotate(180deg);
}
.river.rpos1 {
  right: 0;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center;
}
.river.rpos3 {
  left: 0;
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
}
.river :deep(.latest) {
  outline: 2px solid var(--gold-warm);
  outline-offset: 1px;
  box-shadow: var(--shadow-glow-gold);
}
/* ── 中央罗盘 ── */
.center-disc {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: clamp(132px, 15vh, 196px);
  height: clamp(132px, 15vh, 196px);
  display: grid;
  place-items: center;
  filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.55));
}
.cmp,
.cmp-arrow {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.cmp-arrow {
  transition: transform 400ms var(--ease-out);
  filter: drop-shadow(0 0 6px rgba(201, 160, 99, 0.7));
}
.cmp-wind {
  position: absolute;
  font-size: clamp(13px, 1.5vh, 18px);
  font-weight: 800;
  color: var(--gold-champagne);
  opacity: 0.72;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}
.cmp-wind.wn {
  top: 23%;
}
.cmp-wind.ws {
  bottom: 23%;
}
.cmp-wind.we {
  right: 19%;
}
.cmp-wind.ww {
  left: 19%;
}
.cmp-left {
  font-size: clamp(27px, 3.2vh, 40px);
  font-weight: 800;
  line-height: 1;
  transform: translateY(-5px);
  background: linear-gradient(180deg, #fff8e6 8%, #e6cfa3 54%, #b3924f 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.cmp-left-cap {
  position: absolute;
  top: 62%;
  font-size: clamp(10px, 1.1vh, 13px);
  letter-spacing: 0.14em;
  color: var(--text-disabled);
}

.my-zone {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--safe-bottom) + 6px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 5;
}
.my-head {
  position: absolute;
  z-index: 2;
  left: max(var(--safe-left), 12px);
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: linear-gradient(160deg, rgba(16, 32, 25, 0.9), rgba(6, 15, 11, 0.82));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(201, 160, 99, 0.2);
  border-radius: 999px;
  padding: 6px 16px 6px 6px;
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.1),
    inset 0 -8px 16px rgba(0, 0, 0, 0.34),
    0 10px 24px rgba(0, 0, 0, 0.5);
  transition:
    border-color 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out);
}
.my-head.active {
  border-color: rgba(201, 160, 99, 0.75);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.16),
    inset 0 -8px 16px rgba(0, 0, 0, 0.34),
    0 10px 24px rgba(0, 0, 0, 0.5),
    0 0 22px rgba(201, 160, 99, 0.36);
}

.mavatar {
  font-size: 24px;
  position: relative;
}
.mscore {
  color: var(--gold-champagne);
  font-weight: 700;
  font-size: 13px;
}
.my-melds {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  align-self: flex-start;
  margin-left: 110px;
}
/* 手牌托盘：胡桃木条盘，与桌沿同材质，让手牌“放在托盘上”而不是贴在屏幕底 */
.my-hand {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding: 12px 16px 14px;
  max-width: 96vw;
  overflow-x: auto;
  scrollbar-width: none;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(46, 33, 21, 0.94) 0%, rgba(28, 19, 12, 0.96) 52%, rgba(15, 10, 6, 0.97) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 236, 200, 0.16),
    inset 0 -12px 26px rgba(0, 0, 0, 0.55),
    0 -6px 26px rgba(0, 0, 0, 0.45),
    0 10px 30px rgba(0, 0, 0, 0.5);
}
.my-hand::-webkit-scrollbar {
  display: none;
}
.htile {
  cursor: pointer;
}
.drawn-gap {
  width: 12px;
}

.action-bar {
  position: absolute;
  right: max(var(--safe-right), 16px);
  bottom: calc(var(--safe-bottom) + 96px);
  display: flex;
  gap: 10px;
  z-index: 8;
}
.act {
  min-width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid var(--line-soft);
  font-size: 20px;
  font-weight: 800;
  cursor: pointer;
  color: var(--text-primary);
  background: radial-gradient(circle at 32% 28%, #2c3550, #171d2c);
  box-shadow: var(--shadow-card);
  transition: transform var(--dur-micro) var(--ease-out);
}
.act:active {
  transform: scale(0.92);
}
.act.hu {
  border-color: var(--gold-warm);
  color: var(--gold-champagne);
  background: radial-gradient(circle at 32% 28%, #4a3a1f, #241a08);
  box-shadow: var(--shadow-glow-gold);
  font-size: 24px;
}
.act.pass {
  opacity: 0.8;
}

.trustee-bar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--safe-bottom) + 120px);
  padding: 10px 22px;
  color: var(--accent-jade);
  cursor: pointer;
  z-index: 8;
  font-size: 13px;
}
.chat-btn {
  position: absolute;
  right: max(var(--safe-right), 14px);
  top: 42%;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid var(--line-soft);
  font-size: 17px;
  cursor: pointer;
  z-index: 6;
}
.chat-panel {
  position: absolute;
  right: max(var(--safe-right), 14px);
  top: calc(42% + 48px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  z-index: 7;
  max-width: 240px;
}
.chat-q {
  background: var(--bg-night);
  border: 1px solid rgba(154, 163, 178, 0.15);
  color: var(--text-secondary);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.chat-q:hover {
  color: var(--gold-champagne);
  border-color: var(--gold-warm);
}
.chat-bubbles {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: calc(var(--safe-top) + 54px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 9;
  pointer-events: none;
}
.bubble {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-primary);
}

.settle {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sdraw {
  text-align: center;
  font-size: 20px;
  color: var(--text-secondary);
  padding: 8px;
}
.swin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  background: linear-gradient(180deg, rgba(201, 160, 99, 0.12), transparent);
  border-radius: 12px;
}
.swho {
  font-weight: 800;
  color: var(--gold-champagne);
  font-size: 16px;
}
.show {
  color: var(--gold-warm);
  font-size: 14px;
}
.spat {
  font-size: 11px;
  color: var(--text-secondary);
}
.srows {
  display: flex;
  flex-direction: column;
}
.srow {
  display: flex;
  justify-content: space-between;
  padding: 9px 4px;
  border-bottom: 1px solid rgba(154, 163, 178, 0.08);
  font-size: 14px;
}
.win {
  color: var(--accent-jade);
}
.lose {
  color: var(--accent-crimson);
}
.snext {
  text-align: center;
  font-size: 12px;
  color: var(--text-disabled);
  margin-top: 6px;
}

/* ── 横屏短屏：左右两家的竖排暗牌会超出可视高度，改为只保留座位牌上的 ×N ── */
@media (max-height: 640px) {
  .pos1 .opp-hand,
  .pos3 .opp-hand,
  .pos1 .opp-melds,
  .pos3 .opp-melds {
    display: none;
  }
  .opp.pos1,
  .opp.pos3 {
    transform: translateY(-50%);
  }
  .opp.pos2 {
    top: calc(var(--safe-top) + 46px);
  }
  .opp-head {
    padding: 4px 11px 4px 4px;
    gap: 7px;
  }
  .oname {
    max-width: 60px;
    font-size: 10.5px;
  }
  .my-hand {
    padding: 8px 12px 10px;
    border-radius: 16px;
  }
  /* 短屏：自己的座位牌上移到托盘之上，避免压住第一张手牌 */
  .my-head {
    bottom: calc(100% - 4px);
  }
}
</style>