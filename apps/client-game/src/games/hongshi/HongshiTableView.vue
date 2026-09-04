<template>
  <div class="hs-root">
    <div v-if="phase === 'connecting' || phase === 'matching'" class="overlay">
      <div class="radar"><span /><span /><span /></div>
      <div class="otext">{{ phase === 'matching' ? t('lobby.matching') : t('common.loading') }}</div>
      <GameButton v-if="phase === 'matching'" variant="dark" size="md" sfx="close" @click="cancelMatch">{{ t('lobby.match.cancel') }}</GameButton>
    </div>

    <div v-else-if="phase === 'waiting'" class="overlay">
      <div class="wait-card sk-panel">
        <img class="w-mascot" :src="mascotArt" alt="" draggable="false" />
        <div class="wtitle sk-gold-text">{{ t('game.hongshi') }}</div>
        <div class="wno num">{{ t('room.no', { no: room?.roomNo ?? '' }) }}</div>
        <div class="wbtns">
          <!-- 中文环境使用素材表成品「准备」按钮；其它语言用 CSS 板件 + 程序文字 -->
          <GameButton v-if="zh" :art="readyArt" size="lg" block sfx="confirm" @click="ready(true)" />
          <GameButton v-else variant="green" size="lg" block sfx="confirm" @click="ready(true)">{{ t('room.ready') }}</GameButton>
          <GameButton variant="dark" size="lg" sfx="close" @click="leaveToLobby()">{{ t('room.leave') }}</GameButton>
        </div>
      </div>
    </div>

    <template v-else>
      <TableSurface tone="wine" />
      <div class="hud-top">
        <GameButton round size="md" :art="exitArt" class="hback" sfx="close" @click="askLeave()" />
        <div class="hinfo num">{{ t('room.round', { a: room?.currentRound ?? 1, b: room?.totalRounds ?? 4 }) }}</div>
        <CurrencyBar kind="coin" :value="user.me?.coins ?? 0" class="hcoins" />
      </div>

      <!-- 其他玩家 -->
      <div v-for="p in others" :key="p.uid" class="opp" :class="`pos${p.pos}`">
        <div class="opp-head" :class="{ active: turnSeat === p.seat, off: !p.online }">
          <AvatarBadge :id="p.avatarId" :size="30" />
          <div class="ocol">
            <div class="oname">{{ displayName(p.nickname) }}</div>
            <div class="obadges">
              <span v-if="identityOf(p.seat) !== null" class="camp" :class="{ red: identityOf(p.seat) }">
                <img v-if="identityOf(p.seat)" class="suit-ic" :src="suitHeartArt" alt="" draggable="false" />{{ identityOf(p.seat) ? t('hs.red') : t('hs.blue') }}
              </span>
              <span v-if="rankOf(p.seat)" class="frank">{{ t(`hs.rank${rankOf(p.seat)}`) }}</span>
              <span v-if="p.left" class="frank left">{{ t('room.left') }}</span>
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
          <img v-else-if="passedSeats.has(p.seat) && zh" class="pass-art" :src="noPlayArt" alt="" draggable="false" />
          <span v-else-if="passedSeats.has(p.seat)" class="pass-tag">{{ t('hs.pass') }}</span>
        </div>
      </div>

      <!-- 出牌演出：炸弹 / 有红十（中文用素材爆字，其它语言程序文字） -->
      <transition-group name="pop" tag="div" class="callouts">
        <div v-for="c in callouts" :key="c.id" class="callout" :class="[`cpos${c.pos}`, c.kind]">
          <img v-if="zh && c.art" :src="c.art" alt="" draggable="false" />
          <span v-else class="callout-text">{{ c.text }}</span>
        </div>
      </transition-group>
      <transition name="pop">
        <div v-if="turnSeat === mySeat" class="turn-flag">
          <img v-if="zh" :src="turnArrowArt" alt="" draggable="false" />
          <span v-else class="turn-text">{{ t('hs.yourTurn') }}</span>
        </div>
      </transition>
      <RewardAnimation ref="reward" />

      <!-- 操作按钮：全部走服务端校验（hongshi.play / hongshi.pass / hongshi.hint） -->
      <div v-if="turnSeat === mySeat" class="hs-actions">
        <GameButton variant="dark" size="lg" :disabled="mustLead" sfx="pass" @click="doPass">{{ t('hs.pass') }}</GameButton>
        <GameButton variant="blue" size="lg" sfx="tick" @click="doHint">{{ t('hs.hint') }}</GameButton>
        <GameButton variant="gold" size="lg" :disabled="selected.size === 0" sfx="card" @click="doPlay">{{ t('hs.play') }}</GameButton>
      </div>
      <!-- 结算面板收起后可随时重新查看本局战绩 -->
      <GameButton v-if="!showSettle && result" :art="zh ? settleArt : undefined" variant="purple" size="sm" class="re-settle" sfx="open" @click="showSettle = true">{{ t('hs.settle.title') }}</GameButton>

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


      <!-- 对局中退出确认：本局托管打完并照常结算 -->
      <GamePopup v-model="showLeave" :title="t('room.leave')" skin="blue" size="sm">
        <p class="leave-hint">{{ t('room.leave.hint') }}</p>
        <div class="leave-row">
          <GameButton variant="dark" size="md" sfx="close" @click="showLeave = false">{{ t('common.cancel') }}</GameButton>
          <GameButton variant="gold" size="md" block sfx="confirm" @click="leaveToLobby()">{{ t('room.leave.confirm') }}</GameButton>
        </div>
      </GamePopup>
      <!-- 结算 -->
      <GamePopup v-model="showSettle" :title="t('hs.result')" skin="red" size="md">
        <div v-if="result" class="settle">
          <div class="s-main">
            <div class="s-head">
              <img v-if="myTeamWon" class="s-win fx-pop" :src="winArt" alt="" draggable="false" />
              <span v-else-if="isDraw" class="s-lose draw">{{ t('hs.draw') }}</span>
              <span v-else class="s-lose">{{ t('hs.teamLose') }}</span>
              <img v-if="result.multiplier === 2" class="s-mult fx-pop" :src="x2Art" alt="" draggable="false" />
              <img v-else-if="result.multiplier >= 4" class="s-mult" :src="x4Art" alt="" draggable="false" />
              <span v-else-if="result.multiplier > 1" class="s-mult-text num">×{{ result.multiplier }}</span>
            </div>
            <div v-if="result.solo" class="solo">{{ t('hs.solo') }} · {{ t('hs.multiplier', { n: result.multiplier }) }}</div>
            <div class="srows">
              <div v-for="r in rankRows" :key="r.seat" class="srow">
                <span class="sname">
                  <span class="srank">{{ t(`hs.rank${r.rank}`) }}</span>{{ nameOf(r.seat) }}
                  <span class="camp" :class="{ red: redSeats.includes(r.seat) }">
                    <img v-if="redSeats.includes(r.seat)" class="suit-ic" :src="suitHeartArt" alt="" draggable="false" />{{ redSeats.includes(r.seat) ? t('hs.red') : t('hs.blue') }}
                  </span>
                </span>
                <span class="num sval" :class="(result.scoreChanges[r.seat] ?? 0) > 0 ? 'win' : (result.scoreChanges[r.seat] ?? 0) < 0 ? 'lose' : ''">
                  {{ fmtSigned(result.scoreChanges[r.seat] ?? 0) }}
                </span>
              </div>
            </div>
          </div>
          <img class="s-mascot" :src="mascotArt" alt="" draggable="false" />
        </div>
      </GamePopup>

      <GamePopup v-model="showMatchOver" :title="t('mj.matchOver')" skin="cream" size="md" :closable="false">
        <div class="srows">
          <div v-for="(row, i) in matchTotals" :key="row.seat" class="srow">
            <span class="sname"><span class="srank">{{ i + 1 }}</span>{{ displayName(row.nickname) }}</span>
            <span class="num sval" :class="row.score > 0 ? 'win' : row.score < 0 ? 'lose' : ''">{{ fmtSigned(row.score) }}</span>
          </div>
        </div>
        <GameButton variant="gold" size="lg" block class="s-back" sfx="confirm" @click="leaveToLobby(false)">{{ t('common.back') }}</GameButton>
      </GamePopup>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Ev } from '@yanbian/protocol';
import { gameSocket } from '../../net/ws.js';
import { useUserStore } from '../../stores/user.js';
import { t } from '../../i18n/index.js';
import { displayName } from '../../i18n/names.js';
import { toast } from '../../ui/toast.js';
import GamePopup from '../../ui/GamePopup.vue';
import GameButton from '../../ui/GameButton.vue';
import CurrencyBar from '../../ui/CurrencyBar.vue';
import RewardAnimation from '../../ui/RewardAnimation.vue';
import { asset } from '../../assets/assets.js';
import { audio } from '../../audio/AudioManager.js';
import { currentLocale } from '../../i18n/index.js';
import CountdownRing from '../CountdownRing.vue';
import TableSurface from '../TableSurface.vue';
import PlayCard from './PlayCard.vue';
import { useGameRoom, relativePos } from '../useGameRoom.js';
import AvatarBadge from '../../ui/AvatarBadge.vue';
import { fmtSigned } from '../../ui/format.js';

const user = useUserStore();
const { room, phase, mySeat, on, begin, ready, leaveToLobby, cancelMatch, showLeave, askLeave } = useGameRoom('hongshi');

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

/** 新版美术：含中文烙字的素材只在中文环境使用；其它语言用 CSS 板件 + 程序文字 */
const zh = computed(() => currentLocale.value === 'zh');
const exitArt = asset('common', 'btnExitRound');
const readyArt = asset('red10', 'btnReadyZh');
const settleArt = asset('red10', 'btnSettleZh');
const noPlayArt = asset('red10', 'fxNoPlayZh');
const bombArt = asset('red10', 'fxBombZh');
const hongshiArt = asset('red10', 'fxHongshiZh');
const turnArrowArt = asset('red10', 'turnArrowZh');
const winArt = asset('red10', 'fxWin');
const x2Art = asset('red10', 'fxX2');
const x4Art = asset('red10', 'fxX4');
const mascotArt = asset('red10', 'caishenCard');
const suitHeartArt = asset('red10', 'cardsuit_heart');
const callouts = ref<{ id: number; pos: number; kind: string; text: string; art?: string }[]>([]);
const reward = ref<InstanceType<typeof RewardAnimation> | null>(null);
let calloutSeq = 0;
const redSeats = computed<number[]>(() => {
  const teams = (result.value?.teams ?? []) as { seats: number[]; isRedTeam?: boolean }[];
  return (teams.find((x) => x.isRedTeam) ?? teams[0])?.seats ?? [];
});
const myTeamWon = computed(() => ((result.value?.scoreChanges?.[mySeat.value] as number | undefined) ?? 0) > 0);
/** 平局：四家分数变化全为 0（头游+末游 对 二游+三游） */
const isDraw = computed(() => Object.values((result.value?.scoreChanges ?? {}) as Record<number, number>).every((v) => v === 0));
const rankRows = computed(() => [...((result.value?.ranks ?? []) as { seat: number; rank: number }[])].sort((a, b) => a.rank - b.rank));

function pushCallout(seat: number, kind: string, text: string, art?: string, ms = 1500): void {
  calloutSeq += 1;
  const id = calloutSeq;
  callouts.value.push({ id, pos: relativePos(seat, mySeat.value), kind, text, art });
  setTimeout(() => {
    callouts.value = callouts.value.filter((c) => c.id !== id);
  }, ms);
}

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
const nameOf = (seat: number): string => displayName(room.value?.players.find((p) => p.seat === seat)?.nickname) || `#${seat}`;
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

onBeforeUnmount(() => audio.setScene('none'));

onMounted(async () => {
  audio.setScene('hongshi');
  audio.preload(['card', 'cardSlide', 'deal', 'pass', 'bomb', 'win', 'lose']);
  const snap = await begin(user.me?.uid ?? 0);
  if (snap && (snap as any).game) applySnapshot((snap as any).game);

  on(Ev.RoomGameStart, (d) => {
    resetRound();
    if (room.value) room.value.currentRound = d.currentRound;
    phase.value = 'playing';
  });
  on(Ev.HsDeal, (d) => {
    audio.sfx('deal', { volume: 0.7 });
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
    if (d.comboType === 'bomb') {
      pushCallout(d.seat, 'bomb', t('hs.bomb'), bombArt, 1600);
      audio.sfx('bomb');
    } else {
      audio.sfx(d.seat === mySeat.value ? 'card' : 'cardSlide', { volume: 0.7 });
    }
    lastPlays.value.set(d.seat, d.cards);
    passedSeats.value.delete(d.seat);
    handCounts.value.set(d.seat, d.handLeft);
    if (d.seat === mySeat.value) {
      hand.value = hand.value.filter((c) => !d.cards.includes(c));
      selected.value = new Set();
    }
  });
  on(Ev.HsPass, (d) => {
    if (d.seat !== mySeat.value) audio.sfx('pass', { volume: 0.5 });
    passedSeats.value.add(d.seat);
    passedSeats.value = new Set(passedSeats.value);
  });
  on('hongshi.newTrick', () => {
    lastPlays.value = new Map();
    passedSeats.value = new Set();
  });
  on(Ev.HsIdentityReveal, (d) => {
    for (const s of d.seats ?? []) {
      identities.value.set(s, true);
      pushCallout(s, 'hongshi', t('hs.hasRed'), hongshiArt, 1800);
    }
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
    const myGain = (d.result?.scoreChanges?.[mySeat.value] as number | undefined) ?? 0;
    if (myGain > 0) {
      const mult = (d.result?.multiplier as number | undefined) ?? 1;
      reward.value?.play({ amount: myGain, tier: mult >= 4 ? 'mega' : mult >= 2 ? 'big' : 'normal', banner: t('hs.teamWin'), caption: t('hs.result') });
    } else if (myGain < 0) {
      audio.sfx('lose', { volume: 0.5 });
    }
    const mine = (d.balances as { userId: number; balance: number }[] | undefined)?.find((b) => b.userId === user.me?.uid);
    if (mine) user.setBalance(mine.balance);
    if (room.value) {
      for (const tot of d.totals ?? []) {
        const p = room.value.players.find((x) => x.seat === tot.seat);
        if (p) p.score = tot.score;
      }
    }
    setTimeout(() => (showSettle.value = false), 6600);
  });
  on(Ev.GameMatchOver, (d) => {
    matchTotals.value = [...((d.totals ?? []) as typeof matchTotals.value)].sort((a, b) => b.score - a.score);
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
.leave-hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}
.leave-row {
  display: flex;
  gap: 10px;
}
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
  flex-shrink: 0;
}
.hinfo {
  background: linear-gradient(180deg, rgba(38, 16, 24, 0.92), rgba(16, 6, 11, 0.9));
  border: 1.5px solid var(--sk-gold-3, #c9a063);
  border-radius: 18px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--sk-gold-1, #ffe9a6);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.18),
    0 4px 12px rgba(0, 0, 0, 0.45);
}
.hcoins {
  flex-shrink: 0;
}
.suit-ic {
  height: 11px;
  margin-right: 3px;
  vertical-align: -1px;
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
.pass-art {
  height: clamp(34px, 5.2vh, 50px);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
  animation: callout-in 320ms var(--ease-out);
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
/* 喊话层：炸弹 / 有红十 按相对座位方位弹出 */
.callouts {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
}
.callout {
  position: absolute;
  animation: callout-in 380ms var(--ease-out);
  filter: drop-shadow(0 0 14px rgba(255, 140, 40, 0.7)) drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5));
}
.callout img {
  height: clamp(60px, 10vh, 104px);
}
.callout-text {
  font-family: var(--font-calligraphy);
  font-size: clamp(34px, 5vh, 56px);
  font-weight: 900;
  color: #ffe9a6;
  text-shadow:
    0 0 2px #7a3a00,
    0 0 3px #7a3a00,
    0 0 12px rgba(255, 140, 40, 0.9);
}
.callout.cpos0 {
  left: 50%;
  bottom: 36%;
  transform: translateX(-50%);
}
.callout.cpos2 {
  left: 50%;
  top: 17%;
  transform: translateX(-50%);
}
.callout.cpos1 {
  right: 14%;
  top: 36%;
}
.callout.cpos3 {
  left: 14%;
  top: 36%;
}
@keyframes callout-in {
  0% {
    opacity: 0;
    scale: 1.8;
  }
  60% {
    opacity: 1;
    scale: 0.94;
  }
  100% {
    scale: 1;
  }
}
/* 轮到我出牌 */
.turn-flag {
  position: absolute;
  left: max(var(--safe-left), 14px);
  bottom: calc(var(--safe-bottom) + 126px);
  z-index: 8;
  pointer-events: none;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
  animation: turn-bob 1.1s ease-in-out infinite;
}
.turn-flag img {
  height: clamp(44px, 7vh, 64px);
}
.turn-text {
  display: inline-block;
  font-size: 16px;
  font-weight: 900;
  color: #1a1206;
  background: linear-gradient(180deg, #ffe9a6, #f0b93a 60%, #c98a1c);
  border-radius: 12px;
  padding: 8px 16px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    0 4px 12px rgba(0, 0, 0, 0.5);
}
@keyframes turn-bob {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(6px);
  }
}
.re-settle {
  position: absolute;
  right: max(var(--safe-right), 14px);
  bottom: calc(var(--safe-bottom) + 200px);
  z-index: 8;
  --h: 40px;
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
  display: grid;
  grid-template-columns: 1fr 112px;
  gap: 8px;
  align-items: end;
}
.s-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.s-mascot {
  width: 112px;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.45));
}
.s-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 72px;
}
.s-win {
  height: 92px;
  filter: drop-shadow(0 0 16px rgba(255, 170, 60, 0.6));
}
.s-lose {
  font-size: 22px;
  font-weight: 900;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
}
.s-lose.draw {
  color: #ffe9a6;
}
.s-mult {
  height: 64px;
}
.s-mult-text {
  font-size: 30px;
  font-weight: 900;
  color: #ffe28a;
  text-shadow: var(--sk-outline);
}
.sname {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.srank {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: linear-gradient(180deg, #ffe9a6, #c98a1c);
  color: #1a1206;
  font-size: 11px;
  font-weight: 900;
}
.sval {
  font-weight: 900;
  font-size: 16px;
}
.s-back {
  margin-top: 16px;
}
.w-mascot {
  align-self: center;
  height: 96px;
  margin-top: -56px;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
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
@media (max-height: 640px) {
  .turn-flag {
    bottom: calc(var(--safe-bottom) + 96px);
  }
  .turn-flag img {
    height: 40px;
  }
  .hs-actions {
    bottom: calc(var(--safe-bottom) + 108px);
  }
  .re-settle {
    bottom: calc(var(--safe-bottom) + 150px);
  }
}
@media (max-width: 560px) {
  .settle {
    grid-template-columns: 1fr;
  }
  .s-mascot {
    display: none;
  }
}
/* 结算特效：弹入 + 冲击波，不是静态图 */
.fx-pop {
  animation: fx-pop 620ms var(--ease-out) both;
}
.s-mult.fx-pop {
  animation-delay: 220ms;
}
@keyframes fx-pop {
  0% {
    transform: scale(0.2) rotate(-14deg);
    opacity: 0;
    filter: brightness(2);
  }
  55% {
    transform: scale(1.18) rotate(3deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0);
    filter: brightness(1);
  }
}
</style>
