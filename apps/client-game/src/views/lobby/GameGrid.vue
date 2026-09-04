<template>
  <div class="grid-wrap">
    <!-- 四款游戏 · 2×2 横向卡片：左插画（素材分层 + 程序动效）/ 右文字（名称 / 副标题 / 状态 / 进入），文字全部 HTML，双语 -->
    <div class="cards" role="list">
      <article
        v-for="(g, i) in lobbyGames"
        :key="g.gameId"
        class="gcard"
        :class="[g.gameId, meta(g.gameId).status, { off: g.status !== 'online', pressed: pressed === g.gameId, entering: entering === g.gameId }]"
        :style="{ '--i': i }"
        role="listitem"
        @click="openGame(g)"
      >
        <button
          class="g-hit"
          type="button"
          :aria-label="t('aria.gameCard', { name: gameName(g), desc: t(`game.${g.gameId}.desc`), status: statusLabel(g) })"
          :disabled="g.status !== 'online'"
          @pointerdown="press(g.gameId)"
        >
          <span class="g-ring" aria-hidden="true" />
          <div class="g-art" aria-hidden="true">
            <!-- 延边麻将：牌面扇（CC0 牌面）+ 金色星光。人物插画（背包青年 / 安全帽工人 / 朝鲜族服装女性 / 儿童）待合法素材，见 docs/11 §待完成 -->
            <template v-if="g.gameId === 'mahjong_yanbian'">
              <span class="mj-glow" />
              <span v-for="(tl, k) in MJ_TILES" :key="k" class="tile" :class="`t${k}`">
                <img class="tile-body" :src="tileFront" alt="" draggable="false" decoding="async" />
                <img class="tile-face" :src="tl" alt="" draggable="false" decoding="async" />
              </span>
              <span v-for="k in 4" :key="'s' + k" class="sparkle motion-loop" :class="`s${k}`" />
            </template>
            <!-- 延边红十：红桃 10 与方块 10（公共领域牌面）+ 伴牌 -->
            <template v-else-if="g.gameId === 'hongshi'">
              <span class="hs-glow" />
              <img v-for="(c, k) in HS_CARDS" :key="k" class="card" :class="`c${k}`" :src="c" alt="" draggable="false" decoding="async" />
              <span v-for="k in 3" :key="'s' + k" class="sparkle red motion-loop" :class="`s${k}`" />
            </template>
            <!-- 捕鱼达人：鱼群 + Boss + 炮台 + 光束 + 气泡（游动 / 上浮为程序动效） -->
            <template v-else-if="g.gameId === 'fishing'">
              <span class="beam b1 motion-loop" /><span class="beam b2 motion-loop" />
              <img class="fish shark motion-loop" :src="FISH.shark" alt="" draggable="false" decoding="async" />
              <img class="fish turtle motion-loop" :src="FISH.turtle" alt="" draggable="false" decoding="async" />
              <img v-for="k in 3" :key="'f' + k" class="fish clown motion-loop" :class="`f${k}`" :src="FISH.clown" alt="" draggable="false" decoding="async" />
              <img class="fish boss motion-loop" :src="FISH.boss" alt="" draggable="false" decoding="async" />
              <img class="cannon" :src="FISH.cannon" alt="" draggable="false" decoding="async" />
              <span v-for="k in 6" :key="'b' + k" class="bubble motion-loop" :class="`u${k}`" />
            </template>
            <!-- 水果机：三列符号窗 + 金光 -->
            <template v-else>
              <span class="sl-glow motion-loop" />
              <div class="reelwin">
                <div v-for="(col, ci) in SLOT_COLS" :key="ci" class="reelcol">
                  <img v-for="(sym, si) in col" :key="si" class="sym" :src="sym" alt="" draggable="false" decoding="async" />
                </div>
              </div>
            </template>
          </div>
          <div class="g-body">
            <span class="g-status" :class="meta(g.gameId).status">{{ statusLabel(g) }}</span>
            <h3 class="g-title" :class="{ ko: locale === 'ko' }">{{ gameName(g) }}</h3>
            <p class="g-sub">{{ t(`game.${g.gameId}.desc`) }}</p>
            <span class="g-enter" :aria-hidden="true">{{ t('lobby.enter') }}</span>
          </div>
        </button>
        <div v-if="g.status !== 'online'" class="g-mask" role="status">{{ g.status === 'maintenance' ? t('game.maintenance') : t('lobby.comingSoon') }}</div>
      </article>
    </div>

    <!-- 场次选择 -->
    <GamePopup v-model="showStage" :title="t('lobby.stage.select')" skin="blue" size="md">
      <div v-if="stages.length === 0" class="stage-empty">
        <span>{{ loadError ? t('lobby.loadError') : t('common.loading') }}</span>
        <GameButton v-if="loadError" size="sm" variant="dark" @click="load">{{ t('common.retry') }}</GameButton>
      </div>
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
import { toast } from '../../ui/toast.js';
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

/** 大厅只展示四款游戏；其余游戏（轮盘 / 股票）保留路由与逻辑，不出现在大厅 */
const LOBBY_GAMES = ['mahjong_yanbian', 'hongshi', 'fishing', 'slot_fruit'] as const;
/** 状态标签：规则待确认 / 动画系统重做中的游戏标「开发中」，可完整试玩的标「立即试玩」（不显示在线人数，不伪造数据） */
const META: Record<string, { status: 'dev' | 'play' }> = {
  mahjong_yanbian: { status: 'dev' },
  hongshi: { status: 'dev' },
  fishing: { status: 'dev' },
  slot_fruit: { status: 'play' },
};
const meta = (id: string): { status: 'dev' | 'play' } => META[id] ?? { status: 'play' };

const tileFront = asset('mahjong', 'tileFront');
const MJ_TILES = [asset('mahjong', 'tileMan5'), asset('mahjong', 'tilePin3'), asset('mahjong', 'tileSou7'), asset('mahjong', 'tileHatsu'), asset('mahjong', 'tileChun')];
const HS_CARDS = [asset('red10', 'card7C'), asset('red10', 'cardKH'), asset('red10', 'card10D'), asset('red10', 'card10H'), asset('red10', 'cardAS')];
const FISH = {
  clown: asset('fishing', 'fishClown'),
  shark: asset('fishing', 'fishShark01'),
  turtle: asset('fishing', 'fishTurtle'),
  boss: asset('fishing', 'bossCaishenFish'),
  cannon: asset('fishing', 'cannonLv03'),
};
const SLOT_COLS = [
  [asset('slots', 'slotSeven'), asset('slots', 'slotWatermelon'), asset('slots', 'slotBar')],
  [asset('slots', 'slotCherry'), asset('slots', 'slotDiamond'), asset('slots', 'slotGold')],
  [asset('slots', 'slotLemon'), asset('slots', 'slotGrape'), asset('slots', 'slotOrange')],
];

const locale = currentLocale;
const games = ref<GameItem[]>([]);
const loadError = ref(false);
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
const pressed = ref('');
const entering = ref('');
const stageIcon = asset('common', 'iconCrownRound');

/** 四张卡固定顺序；服务器尚未返回时按「在线」渲染（点击时如场次未到则提示重试），绝不显示假数据 */
const lobbyGames = computed<GameItem[]>(() =>
  LOBBY_GAMES.map((id) => games.value.find((g) => g.gameId === id) ?? { gameId: id, name: t(`game.${id}`), nameKo: t(`game.${id}`), status: 'online', online: 0, stages: [] }),
);

async function load(): Promise<void> {
  try {
    const data = await api<{ games: GameItem[] }>('/api/v1/lobby');
    games.value = data.games;
    loadError.value = false;
  } catch {
    loadError.value = true;
    toast(t('lobby.loadError'), 'error');
  }
}
onMounted(load);
onActivated(load);

/** 卡片名称走 i18n（延边麻将 / 延边红十 / 捕鱼达人 / 水果机），服务器名称仅作未知游戏的兜底 */
function gameName(g: GameItem): string {
  const key = `game.${g.gameId}`;
  const s = t(key);
  return s === key ? (locale.value === 'ko' ? g.nameKo : g.name) : s;
}
function statusLabel(g: GameItem): string {
  if (g.status === 'maintenance') return t('game.maintenance');
  if (g.status !== 'online') return t('lobby.comingSoon');
  return t(`lobby.status.${meta(g.gameId).status}`);
}
function press(id: string): void {
  pressed.value = id;
  setTimeout(() => {
    if (pressed.value === id) pressed.value = '';
  }, 420);
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
  if (g.gameId === 'slot_fruit') return go({ gameId: g.gameId, name: gameName(g), path: '/game/slot' });
  if (g.gameId === 'roulette') return go({ gameId: g.gameId, name: gameName(g), path: '/game/roulette' });
  if (g.gameId === 'stock_updown') return go({ gameId: g.gameId, name: gameName(g), path: '/game/stock' });
  stages.value = g.stages;
  if (stages.value.length === 0 && loadError.value) void load();
  showStage.value = true;
}
function go(req: EnterRequest): void {
  entering.value = req.gameId;
  emit('enter', req);
  setTimeout(() => {
    entering.value = '';
  }, 900);
}
function pickedName(): string {
  const g = lobbyGames.value.find((x) => x.gameId === pickGame.value);
  return g ? gameName(g) : '';
}
function startMatch(s: Stage): void {
  showStage.value = false;
  if (pickGame.value === 'fishing') return go({ gameId: 'fishing', name: pickedName(), path: '/game/fishing', query: { stageId: s.stageId } });
  const path = pickGame.value === 'mahjong_yanbian' ? '/game/mahjong' : '/game/hongshi';
  go({ gameId: pickGame.value, name: pickedName(), path, query: { mode: 'match', stageId: s.stageId } });
}
function openCreate(): void {
  showStage.value = false;
  showCreate.value = true;
}
function createRoom(): void {
  showCreate.value = false;
  const path = pickGame.value === 'hongshi' ? '/game/hongshi' : '/game/mahjong';
  go({ gameId: pickGame.value, name: pickedName(), path, query: { mode: 'create', baseScore: createBase.value, totalRounds: createRounds.value, password: createPassword.value || undefined } });
}
function joinRoom(): void {
  showJoin.value = false;
  const path = pickGame.value === 'hongshi' ? '/game/hongshi' : '/game/mahjong';
  go({ gameId: pickGame.value, name: pickedName(), path, query: { mode: 'join', roomNo: joinNo.value, password: joinPassword.value || undefined } });
}
</script>

<style scoped>
.grid-wrap {
  height: 100%;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
/* ══ 2×2 横向卡片 ══ */
.cards {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(150px, 1fr));
  gap: clamp(10px, 1.6vh, 18px) clamp(12px, 1.4vw, 20px);
}
.gcard {
  position: relative;
  min-height: 0;
  border-radius: 20px;
  isolation: isolate;
  animation: rise-in 480ms var(--ease-out) both;
  animation-delay: calc(80ms + var(--i, 0) * 70ms);
}
.g-hit {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 46% 1fr;
  padding: 0;
  border: 0;
  border-radius: 20px;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(58, 104, 190, 0.35), transparent 60%),
    linear-gradient(135deg, #12295a 0%, #0b1a3f 55%, #081430 100%);
  box-shadow:
    inset 0 0 0 1.5px #5a3c0e,
    inset 0 0 0 3px #e9bf55,
    inset 0 0 0 4.5px #7d4d0c,
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 14px 30px rgba(0, 0, 0, 0.55);
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transform: translateZ(0);
  transition:
    transform 220ms var(--ease-out),
    box-shadow 220ms var(--ease-out);
}
.g-hit:focus-visible {
  outline: 3px solid #ffe28a;
  outline-offset: 3px;
}
.gcard:hover .g-hit,
.g-hit:focus-visible {
  transform: translateY(-5px);
  box-shadow:
    inset 0 0 0 1.5px #5a3c0e,
    inset 0 0 0 3px #ffe28a,
    inset 0 0 0 4.5px #7d4d0c,
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 0 0 1px rgba(255, 226, 138, 0.25),
    0 0 28px rgba(240, 193, 78, 0.45),
    0 20px 40px rgba(0, 0, 0, 0.6);
}
.gcard.pressed .g-hit,
.g-hit:active {
  transform: scale(0.975);
  transition-duration: 90ms;
}
.gcard.entering .g-hit {
  transform: scale(1.03);
  box-shadow:
    inset 0 0 0 3px #fff3c4,
    0 0 40px rgba(255, 226, 138, 0.8),
    0 20px 40px rgba(0, 0, 0, 0.6);
}
/* 点击光圈 */
.g-ring {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  pointer-events: none;
  opacity: 0;
  box-shadow: 0 0 0 0 rgba(255, 226, 138, 0.9);
}
.gcard.pressed .g-ring {
  animation: g-ring 420ms var(--ease-out) both;
}
@keyframes g-ring {
  0% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(255, 226, 138, 0.9);
  }
  100% {
    opacity: 0;
    box-shadow: 0 0 0 18px rgba(255, 226, 138, 0);
  }
}
.gcard.off .g-hit {
  cursor: not-allowed;
  filter: grayscale(0.6) brightness(0.6);
}
/* ── 插画区 ── */
.g-art {
  position: relative;
  overflow: hidden;
  border-radius: 20px 0 0 20px;
}
.g-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 55%, rgba(11, 26, 63, 0.75) 88%, #0b1a3f 100%);
  pointer-events: none;
}
.gcard.mahjong_yanbian .g-art::after,
.gcard.hongshi .g-art::after {
  background: none;
}
.g-art img {
  position: absolute;
  object-fit: contain;
  object-position: center;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5));
}
/* 麻将：牌扇 */
.mj-glow {
  position: absolute;
  inset: 10% 5% 0 10%;
  background: radial-gradient(circle at 50% 60%, rgba(76, 200, 140, 0.35), transparent 65%);
}
.tile {
  position: absolute;
  width: 24%;
  aspect-ratio: 3 / 4;
  bottom: 14%;
  left: 50%;
  transform-origin: 50% 210%;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.55));
}
.tile img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: none;
}
.tile-face {
  padding: 8% 10% 12%;
}
.tile.t0 { transform: translateX(-50%) rotate(-26deg); }
.tile.t1 { transform: translateX(-50%) rotate(-13deg); }
.tile.t2 { transform: translateX(-50%) rotate(0deg); }
.tile.t3 { transform: translateX(-50%) rotate(13deg); }
.tile.t4 { transform: translateX(-50%) rotate(26deg); }
.sparkle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: radial-gradient(circle, #fff6d0 0 25%, transparent 30%), conic-gradient(from 0deg, transparent 0 20%, #ffe28a 25%, transparent 30% 45%, #ffe28a 50%, transparent 55% 70%, #ffe28a 75%, transparent 80% 95%, #ffe28a 100%);
  border-radius: 50%;
  opacity: 0;
  animation: sparkle 2.6s ease-in-out infinite;
}
.sparkle.red {
  filter: hue-rotate(-30deg);
}
.sparkle.s1 { left: 14%; top: 18%; animation-delay: 0s; }
.sparkle.s2 { left: 72%; top: 14%; animation-delay: 0.8s; }
.sparkle.s3 { left: 60%; top: 62%; animation-delay: 1.5s; }
.sparkle.s4 { left: 22%; top: 60%; animation-delay: 2s; }
@keyframes sparkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.4) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(90deg);
  }
}
/* 红十：牌扇 */
.hs-glow {
  position: absolute;
  inset: 10% 5% 0 10%;
  background: radial-gradient(circle at 50% 60%, rgba(220, 60, 70, 0.4), transparent 65%);
}
.card {
  width: 27%;
  bottom: 14%;
  left: 48%;
  border-radius: 6px;
  transform-origin: 50% 170%;
}
.card.c0 { transform: translateX(-50%) rotate(-28deg); }
.card.c1 { transform: translateX(-50%) rotate(-14deg); }
.card.c2 { transform: translateX(-50%) rotate(0deg); }
.card.c3 { transform: translateX(-50%) rotate(14deg); }
.card.c4 { transform: translateX(-50%) rotate(28deg); }
/* 捕鱼：海底 */
.gcard.fishing .g-art {
  background: linear-gradient(180deg, #0a3a6e 0%, #062a55 60%, #041c3c 100%);
}
.beam {
  position: absolute;
  top: -10%;
  width: 18%;
  height: 120%;
  background: linear-gradient(180deg, rgba(160, 220, 255, 0.28), transparent 80%);
  transform: skewX(-18deg);
  animation: beam 6s ease-in-out infinite alternate;
}
.beam.b1 { left: 20%; }
.beam.b2 { left: 55%; animation-delay: 3s; }
@keyframes beam {
  from { opacity: 0.4; transform: skewX(-18deg) translateX(-6%); }
  to { opacity: 1; transform: skewX(-18deg) translateX(6%); }
}
.fish {
  animation: swim 5s ease-in-out infinite alternate;
}
.fish.shark { width: 46%; left: 4%; top: 6%; animation-duration: 7s; }
.fish.turtle { width: 24%; left: 60%; top: 52%; animation-duration: 9s; animation-delay: 1s; }
.fish.clown { width: 16%; }
.fish.clown.f1 { left: 52%; top: 12%; animation-delay: 0.4s; }
.fish.clown.f2 { left: 66%; top: 24%; animation-delay: 1.1s; width: 13%; }
.fish.clown.f3 { left: 58%; top: 34%; animation-delay: 1.8s; width: 12%; }
.fish.boss { width: 30%; left: 10%; top: 44%; animation-duration: 6s; animation-delay: 2s; }
@keyframes swim {
  from { transform: translateX(-4%) translateY(0) rotate(-2deg); }
  50% { transform: translateX(3%) translateY(-3%) rotate(1deg); }
  to { transform: translateX(6%) translateY(2%) rotate(2deg); }
}
.cannon {
  width: 26%;
  right: 4%;
  bottom: -4%;
  z-index: 2;
}
.bubble {
  position: absolute;
  bottom: -8%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid rgba(190, 230, 255, 0.7);
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.6), transparent 60%);
  animation: bubble 5s linear infinite;
}
.bubble.u1 { left: 12%; animation-delay: 0s; }
.bubble.u2 { left: 28%; animation-delay: 1.2s; width: 6px; height: 6px; }
.bubble.u3 { left: 44%; animation-delay: 2.4s; }
.bubble.u4 { left: 62%; animation-delay: 0.7s; width: 10px; height: 10px; }
.bubble.u5 { left: 78%; animation-delay: 3.1s; }
.bubble.u6 { left: 90%; animation-delay: 1.9s; width: 5px; height: 5px; }
@keyframes bubble {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 0.9; }
  100% { transform: translateY(-130%) translateX(8px); opacity: 0; }
}
/* 水果机：符号窗 */
.gcard.slot_fruit .g-art {
  background: linear-gradient(180deg, #2a1240 0%, #150a2c 100%);
}
.sl-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 55%, rgba(255, 200, 80, 0.35), transparent 62%);
  animation: glow 3s ease-in-out infinite alternate;
}
@keyframes glow {
  from { opacity: 0.55; }
  to { opacity: 1; }
}
.reelwin {
  position: absolute;
  inset: 12% 8% 12% 8%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4%;
}
.reelcol {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  align-items: center;
  justify-items: center;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.28);
  box-shadow: inset 0 0 0 1px rgba(240, 193, 78, 0.35);
}
.reelcol .sym {
  position: static;
  width: 88%;
  height: 31%;
  transform: scale(1.35); /* 符号素材自带 16% 透明边距，放大回视觉尺寸 */
}
/* ── 文字区 ── */
.g-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(4px, 0.8vh, 10px);
  padding: 4% 6% 4% 5%;
  min-width: 0;
}
.g-status {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: clamp(10px, 1.2vw, 12px);
  font-weight: 800;
  letter-spacing: 0.04em;
  background: linear-gradient(180deg, #ffe08a, #d9a13a);
  color: #3a2200;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.g-status.dev {
  background: linear-gradient(180deg, #3d78e8, #1e4fbe);
  color: #fff;
}
.g-title {
  margin: 0;
  font-family: var(--font-display-zh);
  font-weight: 400;
  font-size: clamp(20px, 2.6vw, 34px);
  line-height: 1.05;
  letter-spacing: 0.12em;
  color: #fff3c4;
  text-shadow: 0 2px 0 #5a3305, 0 4px 10px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-title.ko {
  font-family: var(--font-display-ko);
  font-weight: 800;
  letter-spacing: 0.02em;
  font-size: clamp(18px, 2.3vw, 30px);
}
.g-sub {
  margin: 0;
  font-size: clamp(11px, 1.25vw, 14px);
  color: #b9c8ea;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-enter {
  align-self: flex-start;
  margin-top: clamp(2px, 0.6vh, 8px);
  padding: 0 clamp(14px, 1.6vw, 22px);
  height: clamp(30px, 4.2vh, 40px);
  line-height: clamp(30px, 4.2vh, 40px);
  border-radius: 999px;
  font-size: clamp(12px, 1.3vw, 15px);
  font-weight: 900;
  color: #3a2200;
  background: linear-gradient(180deg, #fff1b8 0%, #f5c04a 45%, #d9931e 55%, #ffd45c 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    inset 0 -3px 6px rgba(120, 70, 0, 0.35),
    0 4px 10px rgba(0, 0, 0, 0.4);
  transition: transform 120ms var(--ease-out), filter 120ms;
}
.gcard:hover .g-enter {
  filter: brightness(1.08);
}
.gcard.pressed .g-enter {
  transform: scale(0.94);
}
.g-mask {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 20px;
  background: rgba(3, 8, 20, 0.55);
  font-size: 18px;
  font-weight: 900;
  color: #ffe9a8;
  pointer-events: none;
}
/* ── 场次 / 表单（保持原逻辑） ── */
.stage-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px;
  color: #c7d3ee;
}
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stage {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
  box-shadow: inset 0 0 0 1px rgba(240, 193, 78, 0.35);
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 120ms var(--ease-out), background 160ms;
}
.stage:hover {
  background: rgba(255, 255, 255, 0.12);
}
.stage:active {
  transform: scale(0.98);
}
.s-ico {
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.s-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.sname {
  font-size: 16px;
  font-weight: 800;
}
.sinfo {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9fb4e8;
}
.smin {
  color: #ffe9a8;
}
.s-arw {
  width: 10px;
  height: 10px;
  border-right: 2px solid #ffe28a;
  border-top: 2px solid #ffe28a;
  transform: rotate(45deg);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.form label {
  font-size: 13px;
  color: #c9d6f2;
}
.opts {
  display: flex;
  gap: 8px;
}
.input {
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  box-shadow: inset 0 0 0 1px rgba(201, 160, 99, 0.3);
  color: #fff;
  font: inherit;
  font-size: 14px;
}
.input:focus-visible {
  outline: 2px solid #f0c14e;
}
/* ── 响应式：竖屏 / 窄屏单列滚动；手机横屏压缩文字 ── */
@media (max-width: 720px), (orientation: portrait) {
  .cards {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-auto-rows: clamp(140px, 24vh, 210px);
    overflow-y: auto;
    padding-bottom: 8px;
  }
  .g-title {
    font-size: 22px;
  }
  .g-title.ko {
    font-size: 20px;
  }
}
@media (orientation: landscape) and (max-height: 450px) {
  .cards {
    gap: 6px 10px;
  }
  .g-hit {
    grid-template-columns: 42% 1fr;
  }
  .g-body {
    gap: 2px;
    padding: 2% 4%;
  }
  .g-title {
    font-size: 17px;
  }
  .g-title.ko {
    font-size: 15px;
  }
  .g-sub {
    font-size: 10px;
  }
  .g-status {
    font-size: 9px;
    padding: 1px 7px;
  }
  .g-enter {
    height: 24px;
    line-height: 24px;
    font-size: 11px;
    padding: 0 10px;
  }
}
</style>
