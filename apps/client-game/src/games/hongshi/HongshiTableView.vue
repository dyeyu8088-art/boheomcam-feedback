<template>
  <div class="hs-root">
    <div v-if="phase === 'connecting' || phase === 'matching'" class="overlay">
      <div class="radar"><span /><span /><span /></div>
      <div class="otext">{{ phase === 'matching' ? t('lobby.matching') : t('common.loading') }}</div>
      <button v-if="phase === 'matching'" class="btn btn-secondary" @click="cancelMatch">{{ t('lobby.match.cancel') }}</button>
    </div>

    <div v-else-if="phase === 'waiting'" class="overlay">
      <div class="wait-card glass">
        <div class="wtitle">{{ t('game.hongshi') }}</div>
        <div class="wno num">{{ t('room.no', { no: room?.roomNo ?? '' }) }}</div>
        <div class="wbtns">
          <button class="btn btn-primary" style="flex: 1" @click="ready(true)">{{ t('room.ready') }}</button>
          <button class="btn btn-secondary" @click="leaveToLobby()">{{ t('room.leave') }}</button>
        </div>
      </div>
    </div>

    <template v-else>
      <TableSurface tone="wine" />
      <div class="hud-top">
        <button class="hback" @click="leaveToLobby()"><AppIcon name="back" :size="18" /></button>
        <div class="hinfo num">{{ t('room.round', { a: room?.currentRound ?? 1, b: room?.totalRounds ?? 4 }) }}</div>
        <div class="hcoins num"><AppIcon name="coin" :size="15" />{{ fmt(user.me?.coins) }}</div>
      </div>

      <!-- 其他玩家 -->
      <div v-for="p in others" :key="p.uid" class="opp" :class="`pos${p.pos}`">
        <div class="opp-head" :class="{ active: turnSeat === p.seat, off: !p.online }">
          <AvatarBadge :id="p.avatarId" :size="30" />
          <div class="ocol">
            <div class="oname">{{ p.nickname }}</div>
            <div class="obadges">
              <span v-if="identityOf(p.seat) !== null" class="camp" :class="{ red: identityOf(p.seat) }">
                {{ identityOf(p.seat) ? t('hs.red') : t('hs.blue') }}
              </span>
              <span v-if="rankOf(p.seat)" class="frank">{{ t(`hs.rank${rankOf(p.seat)}`) }}</span>
            </div>
          </div>
          <div class="ocount num">×{{ p.handCount }}</div>
          <CountdownRing v-if="turnSeat === p.seat" :deadline="deadlineAt" />
        </div>
      </div>

      <!-- 中央出牌区：四家最近一手围绕中心底盘，视线不再被拉到桌角 -->
      <div class="play-zone">
        <div class="center-area">
          <svg v-if="!anyPlay" class="plate-mark" viewBox="0 0 80 80">
            <path d="M14 56 L30 30 L40 42 L52 22 L66 56 z" fill="#c9a063" opacity="0.09" />
            <circle cx="52" cy="16" r="4.5" fill="#c9a063" opacity="0.09" />
          </svg>
        </div>
        <div v-for="p in seatsRel" :key="p.seat" class="play-slot" :class="`ppos${p.pos}`">
          <template v-if="lastPlayOf(p.seat)">
            <PlayCard v-for="c in lastPlayOf(p.seat)!" :key="c" :card="c" size="sm" class="pcard" />
          </template>
          <span v-else-if="passedSeats.has(p.seat)" class="pass-tag">{{ t('hs.pass') }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="turnSeat === mySeat" class="hs-actions">
        <button class="btn btn-secondary" :disabled="mustLead" @click="doPass">{{ t('hs.pass') }}</button>
        <button class="btn btn-secondary" @click="doHint">{{ t('hs.hint') }}</button>
        <button class="btn btn-primary" :disabled="selected.size === 0" @click="doPlay">{{ t('hs.play') }}</button>
      </div>

      <!-- 手牌 -->
      <div class="my-hand">
        <PlayCard
          v-for="c in hand"
          :key="c"
          :card="c"
          class="hcard"
          :selected="selected.has(c)"
          @click="toggle(c)"
        />
      </div>

      <div v-if="myPlayer?.trustee" class="trustee-bar glass" @click="cancelTrustee">
        {{ t('room.trustee') }} — {{ t('room.trustee.cancel') }}
      </div>

      <!-- 结算 -->
      <ModalSheet v-model="showSettle" :title="t('hs.settle.title')" width="480px">
        <div v-if="result" class="settle">
          <div v-if="result.solo" class="solo">{{ t('hs.solo') }} ×{{ result.multiplier }}</div>
          <div class="srows">
            <div v-for="r in result.ranks" :key="r.seat" class="srow">
              <span>
                {{ t(`hs.rank${r.rank}`) }} · {{ nameOf(r.seat) }}
                <span class="camp" :class="{ red: result.teams[0].seats.includes(r.seat) }">
                  {{ result.teams[0].seats.includes(r.seat) ? t('hs.red') : t('hs.blue') }}
                </span>
              </span>
              <span class="num" :class="(result.scoreChanges[r.seat] ?? 0) > 0 ? 'win' : (result.scoreChanges[r.seat] ?? 0) < 0 ? 'lose' : ''">
                {{ fmtSigned(result.scoreChanges[r.seat] ?? 0) }}
              </span>
            </div>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet v-model="showMatchOver" :title="t('mj.matchOver')" width="480px">
        <div class="srows">
          <div v-for="row in matchTotals" :key="row.seat" class="srow">
            <span>{{ row.nickname }}</span>
            <span class="num" :class="row.score > 0 ? 'win' : row.score < 0 ? 'lose' : ''">{{ fmtSigned(row.score) }}</span>
          </div>
        </div>
        <button class="btn btn-primary" style="width: 100%; margin-top: 16px" @click="leaveToLobby(false)">{{ t('common.back') }}</button>
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
import TableSurface from '../TableSurface.vue';
import PlayCard from './PlayCard.vue';
import { useGameRoom, relativePos } from '../useGameRoom.js';
import AvatarBadge from '../../ui/AvatarBadge.vue';
import AppIcon from '../../ui/AppIcon.vue';
import { fmt, fmtSigned } from '../../ui/format.js';

const user = useUserStore();
const { room, phase, mySeat, on, begin, ready, leaveToLobby, cancelMatch } = useGameRoom('hongshi');

const hand = ref<number[]>([]);
const selected = ref(new Set<number>());
const turnSeat = ref(-1);
const deadlineAt = ref(0);
const mustLead = ref(false);
const lastPlays = ref(new Map<number, number[]>());
const passedSeats = ref(new Set<number>());
const handCounts = ref(new Map<number, number>());
const identities = ref(new Map<number, boolean>());
const finishRanks = ref(new Map<number, number>());
const result = ref<any>(null);
const showSettle = ref(false);
const showMatchOver = ref(false);
const matchTotals = ref<{ seat: number; nickname: string; score: number }[]>([]);

const others = computed(() =>
  (room.value?.players ?? [])
    .filter((p) => p.seat !== mySeat.value)
    .map((p) => ({ ...p, pos: relativePos(p.seat, mySeat.value), handCount: handCounts.value.get(p.seat) ?? 13 })),
);
const myPlayer = computed(() => room.value?.players.find((p) => p.seat === mySeat.value));
/** 四家（含自己）及其相对位：0=下(自己) 1=右 2=上 3=左 */
const seatsRel = computed(() =>
  (room.value?.players ?? []).map((p) => ({ seat: p.seat, pos: relativePos(p.seat, mySeat.value) })),
);
const anyPlay = computed(() => lastPlays.value.size > 0 || passedSeats.value.size > 0);
const nameOf = (seat: number): string => room.value?.players.find((p) => p.seat === seat)?.nickname ?? `#${seat}`;
const lastPlayOf = (seat: number): number[] | null => lastPlays.value.get(seat) ?? null;
const identityOf = (seat: number): boolean | null => (identities.value.has(seat) ? identities.value.get(seat)! : null);
const rankOf = (seat: number): number | undefined => finishRanks.value.get(seat);

const sortHand = (cards: number[]): number[] => {
  const order = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2];
  return cards.sort((a, b) => order.indexOf((a % 13) + 1) - order.indexOf((b % 13) + 1) || a - b);
};

function resetRound(): void {
  hand.value = [];
  selected.value = new Set();
  lastPlays.value = new Map();
  passedSeats.value = new Set();
  handCounts.value = new Map();
  identities.value = new Map();
  finishRanks.value = new Map();
  result.value = null;
  showSettle.value = false;
}

function applySnapshot(game: any): void {
  if (!game) return;
  resetRound();
  hand.value = sortHand([...(game.myHand ?? [])]);
  turnSeat.value = game.turnSeat ?? -1;
  if (game.tableCombo) lastPlays.value.set(game.tableComboSeat, game.tableCombo.cards);
  mustLead.value = game.tableCombo === null;
  for (const p of game.players ?? []) {
    handCounts.value.set(p.seat, p.handCount);
    if (p.finishRank) finishRanks.value.set(p.seat, p.finishRank);
    if (p.identityRevealed && p.isRed !== undefined) identities.value.set(p.seat, p.isRed);
  }
  deadlineAt.value = Date.now() + 10000;
}

onMounted(async () => {
  const snap = await begin(user.me?.uid ?? 0);
  if (snap && (snap as any).game) applySnapshot((snap as any).game);

  on(Ev.RoomGameStart, (d) => {
    resetRound();
    if (room.value) room.value.currentRound = d.currentRound;
    phase.value = 'playing';
  });
  on(Ev.HsDeal, (d) => {
    resetRound();
    hand.value = sortHand([...d.cards]);
    for (const p of room.value?.players ?? []) handCounts.value.set(p.seat, 13);
  });
  on(Ev.HsTurn, (d) => {
    turnSeat.value = d.seat;
    deadlineAt.value = d.deadlineAt ?? Date.now() + 15000;
    mustLead.value = !!d.lead;
    if (d.lead) {
      lastPlays.value = new Map();
      passedSeats.value = new Set();
    }
  });
  on(Ev.HsPlayed, (d) => {
    lastPlays.value.set(d.seat, d.cards);
    passedSeats.value.delete(d.seat);
    handCounts.value.set(d.seat, d.handLeft);
    if (d.seat === mySeat.value) {
      hand.value = hand.value.filter((c) => !d.cards.includes(c));
      selected.value = new Set();
    }
  });
  on(Ev.HsPass, (d) => {
    passedSeats.value.add(d.seat);
    passedSeats.value = new Set(passedSeats.value);
  });
  on('hongshi.newTrick', () => {
    lastPlays.value = new Map();
    passedSeats.value = new Set();
  });
  on(Ev.HsIdentityReveal, (d) => {
    for (const s of d.seats ?? []) identities.value.set(s, true);
    identities.value = new Map(identities.value);
  });
  on('hongshi.finish', (d) => {
    finishRanks.value.set(d.seat, d.rank);
    finishRanks.value = new Map(finishRanks.value);
  });
  on(Ev.HsHint, (d) => {
    if (d.cards) {
      selected.value = new Set(d.cards as number[]);
    } else {
      toast(t('hs.pass'));
    }
  });
  on(Ev.HsRoundEnd, (d) => {
    result.value = d.result;
    showSettle.value = true;
    const mine = (d.balances as { userId: number; balance: number }[] | undefined)?.find((b) => b.userId === user.me?.uid);
    if (mine) user.setBalance(mine.balance);
    if (room.value) {
      for (const tot of d.totals ?? []) {
        const p = room.value.players.find((x) => x.seat === tot.seat);
        if (p) p.score = tot.score;
      }
    }
    setTimeout(() => (showSettle.value = false), 5200);
  });
  on(Ev.GameMatchOver, (d) => {
    matchTotals.value = d.totals ?? [];
    showSettle.value = false;
    showMatchOver.value = true;
  });
});

function toggle(c: number): void {
  const s = new Set(selected.value);
  if (s.has(c)) s.delete(c);
  else s.add(c);
  selected.value = s;
}

function doPlay(): void {
  void gameSocket
    .call('hongshi.play', { cards: [...selected.value] })
    .catch((e) => toast((e as Error).message, 'error'));
}

function doPass(): void {
  void gameSocket.call('hongshi.pass').catch((e) => toast((e as Error).message, 'error'));
}

function doHint(): void {
  gameSocket.send('hongshi.hint', {});
}

function cancelTrustee(): void {
  void gameSocket.call('game.trustee', { on: false }).catch(() => undefined);
}
</script>

<style scoped>
.hs-root {
  height: 100%;
  position: relative;
  overflow: hidden;
  /* 会所环境：牌桌之外的深色空间 */
  background: radial-gradient(120% 100% at 50% 28%, #241019 0%, #170a11 48%, #0d050a 100%);
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
  width: min(440px, 90vw);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
.hinfo,
.hcoins {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--gold-champagne);
}
.opp {
  position: absolute;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}
.opp.pos2 {
  top: calc(var(--safe-top) + 60px);
  left: 50%;
  transform: translateX(-50%);
}
.opp.pos1 {
  right: max(var(--safe-right), 4.5%);
  top: 50%;
  transform: translateY(-50%);
}
.opp.pos3 {
  left: max(var(--safe-left), 4.5%);
  top: 50%;
  transform: translateY(-50%);
}
.opp-head {
  display: flex;
  align-items: center;
  gap: 9px;
  background: linear-gradient(160deg, rgba(38, 16, 24, 0.9), rgba(16, 6, 11, 0.82));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(201, 160, 99, 0.18);
  border-radius: 999px;
  padding: 5px 15px 5px 5px;
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
.opp-head.off {
  opacity: 0.55;
}
.oavatar {
  font-size: 24px;
}
.oname {
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.obadges {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.camp {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(62, 155, 143, 0.25);
  color: var(--accent-jade);
}
.camp.red {
  background: rgba(181, 73, 91, 0.25);
  color: #e8a0ac;
}
.frank {
  font-size: 9px;
  color: var(--gold-warm);
}
.ocount {
  font-size: 13px;
  color: var(--gold-champagne);
  font-weight: 700;
}
.pass-tag {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-secondary);
  background: linear-gradient(160deg, rgba(38, 16, 24, 0.9), rgba(16, 6, 11, 0.85));
  border: 1px solid rgba(201, 160, 99, 0.16);
  border-radius: 10px;
  padding: 5px 13px;
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.08),
    0 6px 14px rgba(0, 0, 0, 0.4);
}
/* 出牌区总容器：四家出牌 + 中心底盘 */
.play-zone {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
  width: clamp(420px, 52vw, 760px);
  height: clamp(300px, 46vh, 480px);
}
/* 中央底盘：牌桌中心的凹陷区，空手时也有明确视觉锚点 */
.center-area {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  min-width: clamp(180px, 22vw, 320px);
  min-height: clamp(96px, 13vh, 148px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background: radial-gradient(70% 90% at 50% 34%, rgba(255, 232, 198, 0.06), rgba(0, 0, 0, 0.28) 74%);
  border: 1px solid rgba(201, 160, 99, 0.16);
  box-shadow:
    inset 0 2px 12px rgba(0, 0, 0, 0.5),
    inset 0 -1px 0 rgba(255, 236, 200, 0.07);
}
.center-area::after {
  content: '';
  position: absolute;
  inset: 9px;
  border-radius: 15px;
  border: 1px solid rgba(201, 160, 99, 0.08);
  pointer-events: none;
}
/* 中央纹章水印（无人出牌时） */
.plate-mark {
  width: 46%;
  max-width: 96px;
  opacity: 0.9;
}
/* 四家出牌槽：贴着中心底盘的四边 */
.play-slot {
  position: absolute;
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
}
.play-slot .pcard:not(:first-child) {
  margin-left: -14px;
}
.play-slot.ppos0 {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}
.play-slot.ppos2 {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}
.play-slot.ppos1 {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}
.play-slot.ppos3 {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}
.hs-actions {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--safe-bottom) + 128px);
  display: flex;
  gap: 12px;
  z-index: 8;
}
/* 手牌托盘：与桌沿同材质的胡桃木条盘 */
.my-hand {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--safe-bottom) + 10px);
  display: flex;
  z-index: 6;
  max-width: 96vw;
  padding: 14px 20px 16px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(46, 27, 24, 0.94) 0%, rgba(28, 15, 14, 0.96) 52%, rgba(15, 7, 7, 0.97) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 236, 200, 0.16),
    inset 0 -12px 26px rgba(0, 0, 0, 0.55),
    0 -6px 26px rgba(0, 0, 0, 0.45),
    0 10px 30px rgba(0, 0, 0, 0.5);
}
.hcard {
  margin-left: calc(min(52px, 7vw) * -0.45);
  cursor: pointer;
}
.hcard:first-child {
  margin-left: 0;
}
.trustee-bar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--safe-bottom) + 190px);
  padding: 10px 22px;
  color: var(--accent-jade);
  cursor: pointer;
  z-index: 8;
  font-size: 13px;
}
.settle {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.solo {
  text-align: center;
  color: var(--gold-champagne);
  font-weight: 800;
  font-size: 16px;
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
</style>
