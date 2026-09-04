<template>
  <div class="grid-wrap">
    <!-- 公告条 -->
    <div v-if="marquee" class="notice">
      <img class="n-ico" :src="megaphone" alt="" draggable="false" />
      <div class="n-track"><span class="n-text">{{ marquee }}</span></div>
    </div>

    <!-- 六个游戏入口（素材立绘 + 程序文字；状态由服务器 games 表决定） -->
    <div class="cards">
      <article
        v-for="(g, i) in orderedGames"
        :key="g.gameId"
        class="gcard"
        :class="[g.gameId, { off: g.status !== 'online' }]"
        :style="{ animationDelay: `${80 + i * 60}ms` }"
        @click="openGame(g)"
      >
        <div class="g-bg" />
        <div class="g-art">
          <img v-for="(l, k) in ART[g.gameId]?.layers ?? []" :key="k" :src="l.src" :style="l.style" :class="['g-layer', l.cls]" alt="" draggable="false" decoding="async" />
        </div>
        <div class="g-scrim" />
        <div class="g-body">
          <div class="g-tags">
            <span v-if="g.gameId === 'mahjong_yanbian'" class="g-tag rec">{{ t('lobby.recommend') }}</span>
            <span v-else-if="g.gameId === 'fishing'" class="g-tag hot">{{ t('lobby.hot') }}</span>
          </div>
          <h3 class="g-title" :class="{ ko: locale === 'ko' }">{{ locale === 'ko' ? g.nameKo : g.name }}</h3>
          <p class="g-sub">{{ t(`game.${g.gameId}.desc`) }}</p>
          <div class="g-foot">
            <span class="g-online num"><i class="dot" />{{ t('lobby.online', { n: g.online }) }}</span>
            <span class="g-enter">{{ t('lobby.enter') }}</span>
          </div>
        </div>
        <div v-if="g.status !== 'online'" class="g-mask">{{ g.status === 'maintenance' ? t('game.maintenance') : t('lobby.comingSoon') }}</div>
      </article>
    </div>

    <!-- 场次选择 -->
    <GamePopup v-model="showStage" :title="t('lobby.stage.select')" skin="blue" size="md">
      <div class="stage-list">
        <button v-for="s in stages" :key="s.stageId" class="stage" type="button" @click="startMatch(s)">
          <img class="s-ico" :src="stageIcon" alt="" />
          <span class="s-left">
            <span class="sname">{{ locale === 'ko' ? s.nameKo ?? s.name : s.name }}</span>
            <span class="sinfo">
              <span>{{ t('lobby.stage.base', { n: s.baseScore }) }}</span>
              <span class="smin">{{ t('lobby.stage.min', { n: fmt(s.minCoins) }) }}</span>
            </span>
          </span>
          <i class="s-arw" />
        </button>
      </div>
      <template v-if="pickGame === 'mahjong_yanbian' || pickGame === 'hongshi'" #footer>
        <GameButton variant="blue" size="md" @click="openCreate">{{ t('lobby.createRoom') }}</GameButton>
        <GameButton variant="green" size="md" @click="showJoin = true">{{ t('lobby.joinRoom') }}</GameButton>
      </template>
    </GamePopup>

    <!-- 创建好友房 -->
    <GamePopup v-model="showCreate" :title="t('lobby.friendRoom')" skin="blue" size="sm">
      <div class="form">
        <label>{{ t('lobby.baseScore') }}</label>
        <BetStepper v-model="createBase" :options="[10, 50, 100, 500]" :skin="pickGame === 'hongshi' ? 'red10' : 'mahjong'" class="form-stepper" />
        <label>{{ t('lobby.rounds') }}</label>
        <div class="opts">
          <GameButton v-for="r in [4, 8, 16]" :key="r" size="sm" :variant="createRounds === r ? 'gold' : 'dark'" @click="createRounds = r">{{ r }}</GameButton>
        </div>
        <input v-model="createPassword" class="input" :placeholder="t('lobby.password.optional')" maxlength="8" />
      </div>
      <template #footer>
        <GameButton variant="gold" size="lg" sfx="confirm" @click="createRoom">{{ t('lobby.createRoom') }}</GameButton>
      </template>
    </GamePopup>

    <!-- 加入房间 -->
    <GamePopup v-model="showJoin" :title="t('lobby.joinRoom')" skin="blue" size="sm">
      <div class="form">
        <input v-model="joinNo" class="input num" :placeholder="t('lobby.roomNo.placeholder')" maxlength="6" inputmode="numeric" />
        <input v-model="joinPassword" class="input" :placeholder="t('lobby.password.optional')" maxlength="8" />
      </div>
      <template #footer>
        <GameButton variant="gold" size="lg" :disabled="joinNo.length !== 6" sfx="confirm" @click="joinRoom">{{ t('lobby.joinRoom') }}</GameButton>
      </template>
    </GamePopup>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import { asset } from '../../assets/assets.js';
import { fmt } from '../../ui/format.js';
import GamePopup from '../../ui/GamePopup.vue';
import GameButton from '../../ui/GameButton.vue';
import BetStepper from '../../ui/BetStepper.vue';

export interface EnterRequest {
  gameId: string;
  name: string;
  path: string;
  query?: Record<string, string | number | undefined>;
}
const emit = defineEmits<{ (e: 'enter', req: EnterRequest): void }>();

interface Stage {
  stageId: string;
  name: string;
  nameKo?: string;
  minCoins: number;
  baseScore: number;
  totalRounds: number;
}
interface GameItem {
  gameId: string;
  name: string;
  nameKo: string;
  status: string;
  online: number;
  stages: Stage[];
}

const locale = currentLocale;
const games = ref<GameItem[]>([]);
const marquee = ref('');
const showStage = ref(false);
const showCreate = ref(false);
const showJoin = ref(false);
const stages = ref<Stage[]>([]);
const pickGame = ref('');
const createBase = ref(10);
const createRounds = ref(4);
const createPassword = ref('');
const joinNo = ref('');
const joinPassword = ref('');
const megaphone = asset('common', 'iconMegaphoneRound');
const stageIcon = asset('common', 'iconCrownRound');

const ORDER = ['mahjong_yanbian', 'hongshi', 'fishing', 'slot_fruit', 'roulette', 'stock_updown'];
const orderedGames = computed(() => [...games.value].sort((a, b) => ORDER.indexOf(a.gameId) - ORDER.indexOf(b.gameId)));

/** 每张卡的立绘层：素材 + 定位（百分比，随卡片缩放） */
const ART: Record<string, { layers: { src: string; style: Record<string, string>; cls?: string }[] }> = {
  mahjong_yanbian: {
    layers: [
      { src: asset('lobby', 'logoMahjongMaster'), style: { left: '4%', top: '6%', width: '46%' }, cls: 'logo' },
      { src: asset('mahjong', 'caishenFaTile'), style: { right: '-2%', bottom: '-4%', height: '108%' }, cls: 'hero' },
    ],
  },
  hongshi: {
    layers: [
      { src: asset('lobby', 'logoRed10'), style: { left: '3%', top: '4%', width: '44%' }, cls: 'logo' },
      { src: asset('red10', 'caishenCard'), style: { right: '0%', bottom: '-6%', height: '110%' }, cls: 'hero' },
    ],
  },
  fishing: {
    layers: [
      { src: asset('fishing', 'fishShark01'), style: { left: '2%', top: '8%', width: '48%' }, cls: 'float' },
      { src: asset('fishing', 'fishClown'), style: { left: '30%', top: '46%', width: '20%' }, cls: 'float2' },
      { src: asset('fishing', 'cannonLv03'), style: { right: '4%', bottom: '-6%', height: '84%' }, cls: 'hero' },
    ],
  },
  slot_fruit: {
    layers: [
      { src: asset('slots', 'slotSeven'), style: { left: '6%', top: '10%', width: '26%' }, cls: 'float' },
      { src: asset('slots', 'slotCherry'), style: { left: '30%', top: '40%', width: '22%' }, cls: 'float2' },
      { src: asset('slots', 'slotDiamond'), style: { left: '8%', top: '54%', width: '20%' }, cls: 'float' },
      { src: asset('slots', 'caishenRound'), style: { right: '2%', bottom: '-4%', height: '96%' }, cls: 'hero' },
    ],
  },
  roulette: {
    layers: [
      { src: asset('roulette', 'wheelHero'), style: { left: '-4%', top: '4%', width: '62%' }, cls: 'spin' },
      { src: asset('roulette', 'rouletteChip1k'), style: { left: '52%', top: '56%', width: '14%' }, cls: 'float2' },
      { src: asset('roulette', 'caishenRound'), style: { right: '2%', bottom: '-6%', height: '92%' }, cls: 'hero' },
    ],
  },
  stock_updown: {
    layers: [
      { src: asset('stock_game', 'iconBull'), style: { left: '6%', top: '10%', width: '24%' }, cls: 'float' },
      { src: asset('stock_game', 'iconBear'), style: { left: '30%', top: '44%', width: '20%' }, cls: 'float2' },
      { src: asset('stock_game', 'caishenAnalyst'), style: { right: '2%', bottom: '-6%', height: '104%' }, cls: 'hero' },
    ],
  },
};

async function load(): Promise<void> {
  try {
    const data = await api<{ games: GameItem[] }>('/api/v1/lobby');
    games.value = data.games;
  } catch {
    /* Toast 由拦截层 */
  }
  try {
    const a = await api<{ items: { title: string; title_ko: string }[] }>('/api/v1/announcements');
    if (a.items[0]) marquee.value = locale.value === 'ko' ? a.items[0].title_ko || a.items[0].title : a.items[0].title;
  } catch {
    /* noop */
  }
}
onMounted(load);
onActivated(load);

function displayName(g: GameItem): string {
  return locale.value === 'ko' ? g.nameKo : g.name;
}
function openGame(g: GameItem): void {
  if (g.status !== 'online') return;
  pickGame.value = g.gameId;
  if (g.gameId === 'fishing') {
    stages.value = [
      { stageId: 'fishing_novice', name: '珊瑚湾·新手场', nameKo: '산호만 · 초보 방', minCoins: 1000, baseScore: 10, totalRounds: 0 },
      { stageId: 'fishing_deep', name: '深渊海沟·高手场', nameKo: '심해 해구 · 고수 방', minCoins: 50000, baseScore: 100, totalRounds: 0 },
    ];
    showStage.value = true;
    return;
  }
  if (g.gameId === 'slot_fruit') return emit('enter', { gameId: g.gameId, name: displayName(g), path: '/game/slot' });
  if (g.gameId === 'roulette') return emit('enter', { gameId: g.gameId, name: displayName(g), path: '/game/roulette' });
  if (g.gameId === 'stock_updown') return emit('enter', { gameId: g.gameId, name: displayName(g), path: '/game/stock' });
  stages.value = g.stages;
  showStage.value = true;
}
function gameName(): string {
  const g = games.value.find((x) => x.gameId === pickGame.value);
  return g ? displayName(g) : '';
}
function startMatch(s: Stage): void {
  showStage.value = false;
  if (pickGame.value === 'fishing') return emit('enter', { gameId: 'fishing', name: gameName(), path: '/game/fishing', query: { stageId: s.stageId } });
  const path = pickGame.value === 'mahjong_yanbian' ? '/game/mahjong' : '/game/hongshi';
  emit('enter', { gameId: pickGame.value, name: gameName(), path, query: { mode: 'match', stageId: s.stageId } });
}
function openCreate(): void {
  showStage.value = false;
  showCreate.value = true;
}
function createRoom(): void {
  showCreate.value = false;
  const path = pickGame.value === 'hongshi' ? '/game/hongshi' : '/game/mahjong';
  emit('enter', { gameId: pickGame.value, name: gameName(), path, query: { mode: 'create', baseScore: createBase.value, totalRounds: createRounds.value, password: createPassword.value || undefined } });
}
function joinRoom(): void {
  showJoin.value = false;
  const path = pickGame.value === 'hongshi' ? '/game/hongshi' : '/game/mahjong';
  emit('enter', { gameId: pickGame.value, name: gameName(), path, query: { mode: 'join', roomNo: joinNo.value, password: joinPassword.value || undefined } });
}
</script>

<style scoped>
.grid-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
}
/* ══ 公告条 ══ */
.notice {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 0 16px 0 8px;
  border-radius: 23px;
  background: linear-gradient(90deg, rgba(8, 20, 60, 0.85), rgba(4, 10, 34, 0.6));
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 3px #f0c14e,
    0 6px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  animation: rise-in 420ms var(--ease-out) both;
}
.n-ico {
  height: 36px;
  width: 36px;
  flex-shrink: 0;
}
.n-track {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
}
.n-text {
  display: inline-block;
  font-size: 13px;
  color: #fff3c4;
  letter-spacing: 0.02em;
  animation: notice-scroll 26s linear infinite;
}
@keyframes notice-scroll {
  0% {
    transform: translateX(8%);
  }
  100% {
    transform: translateX(-100%);
  }
}
/* ══ 六张游戏卡 ══ */
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: clamp(190px, 31vh, 360px);
  gap: 18px;
}
.gcard {
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  cursor: pointer;
  isolation: isolate;
  box-shadow:
    inset 0 0 0 2px #3c2a0a,
    inset 0 0 0 4px #f0c14e,
    inset 0 0 0 6px #7d4d0c,
    0 14px 30px rgba(0, 0, 0, 0.55);
  transform: translateZ(0);
  transition:
    transform 220ms var(--ease-out),
    box-shadow 220ms var(--ease-out);
  animation: rise-in 480ms var(--ease-out) both;
}
.gcard:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow:
    inset 0 0 0 2px #3c2a0a,
    inset 0 0 0 4px #ffe28a,
    inset 0 0 0 6px #7d4d0c,
    0 20px 40px rgba(0, 0, 0, 0.6),
    0 0 30px rgba(248, 199, 74, 0.35);
}
.gcard:active {
  transform: scale(0.985);
}
.gcard.off {
  cursor: default;
}
.g-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.12), transparent 50%), linear-gradient(160deg, #18397e, #0a1b52 55%, #060f33);
}
.gcard.mahjong_yanbian .g-bg {
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.12), transparent 50%), linear-gradient(160deg, #146b4a, #0a3f2c 55%, #052318);
}
.gcard.hongshi .g-bg {
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.12), transparent 50%), linear-gradient(160deg, #8a1c2a, #55101c 55%, #2e0810);
}
.gcard.fishing .g-bg {
  background: radial-gradient(ellipse at 30% 20%, rgba(180, 240, 255, 0.22), transparent 50%), linear-gradient(160deg, #0f7fb0, #0a3f7a 55%, #061c46);
}
.gcard.slot_fruit .g-bg {
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 240, 200, 0.18), transparent 50%), linear-gradient(160deg, #7a2a0c, #4a1408 55%, #260906);
}
.gcard.roulette .g-bg {
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.12), transparent 50%), linear-gradient(160deg, #5a1d6e, #2d0f48 55%, #150626);
}
.gcard.stock_updown .g-bg {
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.1), transparent 50%), linear-gradient(160deg, #1b2a4a, #0d1630 55%, #060a1c);
}
.g-art {
  position: absolute;
  inset: 6px;
  z-index: 1;
  overflow: hidden;
  border-radius: 16px;
}
.g-layer {
  position: absolute;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.55));
  transition: transform 300ms var(--ease-out);
}
.g-layer.hero {
  transform-origin: bottom right;
}
.gcard:hover .g-layer.hero {
  transform: scale(1.04) translateY(-2px);
}
.g-layer.float {
  animation: g-float 3.6s ease-in-out infinite;
}
.g-layer.float2 {
  animation: g-float 4.4s ease-in-out infinite reverse;
}
.g-layer.spin {
  animation: g-spin 40s linear infinite;
}
@keyframes g-float {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-8px) rotate(2deg);
  }
}
@keyframes g-spin {
  to {
    transform: rotate(360deg);
  }
}
.g-scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(180deg, transparent 40%, rgba(2, 6, 20, 0.55) 72%, rgba(2, 6, 20, 0.9) 100%);
  pointer-events: none;
}
.g-tags {
  display: flex;
  gap: 6px;
  min-height: 0;
}
.g-tags:empty {
  display: none;
}
.g-tag {
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 8px;
  color: #2a1500;
  background: linear-gradient(180deg, #ffe38b, #f0a730);
  box-shadow:
    inset 0 0 0 1px #8f5a12,
    0 2px 6px rgba(0, 0, 0, 0.5);
}
.g-tag.hot {
  color: #fff;
  background: linear-gradient(180deg, #ff7d6a, #c8161a);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}
.g-body {
  position: absolute;
  z-index: 3;
  left: 18px;
  right: 18px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}
.g-title {
  margin: 0;
  font-family: var(--font-display-zh);
  font-size: 34px;
  font-weight: 400;
  letter-spacing: 0.12em;
  line-height: 1;
  background: linear-gradient(180deg, #fff6d5 0%, #ffd867 45%, #f39a1e 60%, #ffe28a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 #5a3305) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.72));
}
.g-title.ko {
  font-family: var(--font-display-ko);
  font-weight: 800;
  font-size: 28px;
  letter-spacing: 0.04em;
}
.g-sub {
  margin: 0;
  font-size: 13px;
  color: #ffe9a6;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.g-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}
.g-online {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #7cf36a;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}
.g-enter {
  font-size: 13px;
  font-weight: 800;
  padding: 5px 14px;
  border-radius: 10px;
  color: #2a1500;
  background: linear-gradient(180deg, #ffe38b 0%, #f9c245 48%, #ef9a1f 52%, #ffcf5a 100%);
  box-shadow:
    inset 0 0 0 1.5px #8f5a12,
    0 3px 8px rgba(0, 0, 0, 0.5);
}
.g-mask {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: #fff;
  text-shadow: var(--sk-outline);
  background: rgba(3, 8, 24, 0.62);
  backdrop-filter: grayscale(0.6);
}
/* ══ 场次 / 表单 ══ */
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stage {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 0;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.28);
  box-shadow: inset 0 0 0 1.5px rgba(248, 199, 74, 0.45);
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 140ms var(--ease-out);
}
.stage:hover {
  transform: translateX(4px);
  box-shadow: inset 0 0 0 1.5px #ffe28a;
}
.s-ico {
  width: 40px;
  height: 40px;
}
.s-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sname {
  font-size: 16px;
  font-weight: 800;
  color: #fff6d5;
}
.sinfo {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9fb4e8;
}
.smin {
  color: #ffe28a;
}
.s-arw {
  width: 10px;
  height: 10px;
  border-right: 2px solid #ffe28a;
  border-bottom: 2px solid #ffe28a;
  transform: rotate(-45deg);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.form label {
  font-size: 12px;
  color: #9fb4e8;
}
.form-stepper {
  align-self: center;
}
.opts {
  display: flex;
  gap: 8px;
}
.input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 0;
  background: rgba(0, 0, 0, 0.35);
  box-shadow: inset 0 0 0 1.5px rgba(248, 199, 74, 0.5);
  color: #fff;
  font: inherit;
  font-size: 15px;
  outline: none;
}
.input:focus {
  box-shadow: inset 0 0 0 2px #ffe28a;
}
/* ══ 响应式 ══ */
@media (max-width: 1180px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: clamp(180px, 24vh, 260px);
  }
}
@media (orientation: landscape) and (max-height: 700px) {
  .cards {
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: minmax(150px, 1fr);
  }
  .g-title {
    font-size: 24px;
  }
  .g-title.ko {
    font-size: 20px;
  }
  .g-sub {
    display: none;
  }
}
/* 手机横屏：六张卡单行，只留标题与在线数 */
@media (orientation: landscape) and (max-height: 450px) {
  .cards {
    grid-template-columns: repeat(6, 1fr);
    grid-auto-rows: minmax(96px, 1fr);
    gap: 8px;
  }
  .gcard {
    border-radius: 14px;
  }
  .g-title {
    font-size: 15px;
  }
  .g-title.ko {
    font-size: 13px;
  }
  .g-sub,
  .g-enter,
  .g-tag {
    display: none;
  }
}
@media (max-width: 720px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 170px;
    gap: 12px;
  }
  .g-title {
    font-size: 24px;
  }
  .g-title.ko {
    font-size: 20px;
  }
  .g-sub {
    font-size: 11px;
  }
  .g-enter {
    display: none;
  }
}
@media (max-width: 480px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
