<template>
  <div class="grid-wrap">
    <!-- 顶行：公告条 + 快捷功能卡（同一行，消除空白带） -->
    <div class="toprow">
      <div v-if="marquee" class="notice">
        <span class="n-ico"><AppIcon name="megaphone" :size="18" /></span>
        <div class="n-track"><span class="n-text">{{ marquee }}</span></div>
        <span class="n-edge" />
      </div>
      <div class="features">
        <button v-for="(f, i) in featureList" :key="f.key" class="feat" :style="{ animationDelay: `${60 + i * 40}ms` }" @click="$emit('openFeature', f.key)">
          <span class="f-plate"><AppIcon :name="f.icon" :size="24" /></span>
          <span class="f-label">{{ t(f.label) }}</span>
        </button>
      </div>
    </div>

    <!-- 游戏海报卡（非对称：麻将占主位） -->
    <div class="posters">
      <article
        v-for="(g, i) in orderedGames"
        :key="g.gameId"
        class="poster-card"
        :class="[g.gameId, { hero: g.gameId === 'mahjong_yanbian', off: g.status !== 'online' }]"
        :style="{ animationDelay: `${120 + i * 70}ms` }"
        @click="openGame(g)"
      >
        <div class="p-art"><GameCardArt :game="g.gameId" :layout="artLayout(g.gameId)" /></div>
        <div class="p-scrim" />
        <div class="p-sheen" />
        <div class="p-frame" />
        <i v-for="c in ['tl', 'tr', 'bl', 'br']" :key="c" class="p-corner" :class="c" />

        <div class="p-tags">
          <span v-if="g.gameId === 'mahjong_yanbian'" class="p-tag rec">{{ t('lobby.recommend') }}</span>
          <span v-else-if="g.gameId === 'fishing'" class="p-tag hot">{{ t('lobby.hot') }}</span>
        </div>

        <div class="p-body">
          <h3 class="p-title" :class="{ ko: locale === 'ko' }">{{ locale === 'ko' ? g.nameKo : g.name }}</h3>
          <p class="p-sub">{{ t(`game.${g.gameId}.desc`) }}</p>
          <div class="p-foot">
            <span class="p-online num"><i class="dot" />{{ t('lobby.online', { n: g.online }) }}</span>
            <span class="p-enter">{{ t('lobby.enter') }}<i class="arw" /></span>
          </div>
        </div>

        <div v-if="g.status !== 'online'" class="p-mask">{{ t('game.maintenance') }}</div>
      </article>
    </div>

    <!-- 场次选择 -->
    <ModalSheet v-model="showStage" :title="t('lobby.stage.select')">
      <div class="stage-list">
        <div v-for="s in stages" :key="s.stageId" class="stage" @click="startMatch(s)">
          <div class="s-left">
            <div class="sname">{{ locale === 'ko' ? (s as any).nameKo ?? s.name : s.name }}</div>
            <div class="sinfo">
              <span>{{ t('lobby.stage.base', { n: s.baseScore }) }}</span>
              <span class="smin">{{ t('lobby.stage.min', { n: fmt(s.minCoins) }) }}</span>
            </div>
          </div>
          <i class="s-arw" />
        </div>
      </div>
      <div v-if="pickGame === 'mahjong_yanbian' || pickGame === 'hongshi'" class="friend-row">
        <button class="btn btn-secondary" style="flex: 1" @click="openCreate">{{ t('lobby.createRoom') }}</button>
        <button class="btn btn-secondary" style="flex: 1" @click="showJoin = true">{{ t('lobby.joinRoom') }}</button>
      </div>
    </ModalSheet>

    <!-- 创建好友房 -->
    <ModalSheet v-model="showCreate" :title="t('lobby.friendRoom')">
      <div class="form">
        <label>{{ t('lobby.baseScore') }}</label>
        <div class="opts">
          <button v-for="b in [10, 50, 100, 500]" :key="b" :class="{ on: createBase === b }" @click="createBase = b">{{ b }}</button>
        </div>
        <label>{{ t('lobby.rounds') }}</label>
        <div class="opts">
          <button v-for="r in [4, 8, 16]" :key="r" :class="{ on: createRounds === r }" @click="createRounds = r">{{ r }}</button>
        </div>
        <input v-model="createPassword" class="input" :placeholder="t('lobby.password.optional')" maxlength="8" />
        <button class="btn btn-primary" @click="createRoom">{{ t('lobby.createRoom') }}</button>
      </div>
    </ModalSheet>

    <!-- 加入房间 -->
    <ModalSheet v-model="showJoin" :title="t('lobby.joinRoom')">
      <div class="form">
        <input v-model="joinNo" class="input num" :placeholder="t('lobby.roomNo.placeholder')" maxlength="6" inputmode="numeric" />
        <input v-model="joinPassword" class="input" :placeholder="t('lobby.password.optional')" maxlength="8" />
        <button class="btn btn-primary" :disabled="joinNo.length !== 6" @click="joinRoom">{{ t('lobby.joinRoom') }}</button>
      </div>
    </ModalSheet>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import ModalSheet from '../../ui/ModalSheet.vue';
import AppIcon from '../../ui/AppIcon.vue';
import GameCardArt from './GameCardArt.vue';
import { fmt } from '../../ui/format.js';

defineEmits<{ (e: 'openFeature', key: string): void }>();

interface GameItem {
  gameId: string;
  name: string;
  nameKo: string;
  status: string;
  online: number;
  stages: { stageId: string; name: string; minCoins: number; baseScore: number; totalRounds: number }[];
}

const router = useRouter();
const locale = currentLocale;
const games = ref<GameItem[]>([]);
const marquee = ref('');
const showStage = ref(false);
const showCreate = ref(false);
const showJoin = ref(false);
const stages = ref<GameItem['stages']>([]);
const pickGame = ref('');
const createBase = ref(10);
const createRounds = ref(4);
const createPassword = ref('');
const joinNo = ref('');
const joinPassword = ref('');

/** 延边麻将为旗舰，恒定排首位（视觉优先级最高） */
const ORDER = ['mahjong_yanbian', 'hongshi', 'fishing', 'slot_fruit'];
const orderedGames = computed(() =>
  [...games.value].sort((a, b) => ORDER.indexOf(a.gameId) - ORDER.indexOf(b.gameId)),
);

/**
 * 旗舰卡在宽屏是横构图（1.62fr 的宽卡），在手机竖屏 2×2 网格里会变成竖卡，
 * 此时必须切到窄构图，否则主体会被底部标题压住。
 */
const narrowQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)') : null;
const isNarrow = ref(narrowQuery?.matches ?? false);
function onNarrowChange(e: MediaQueryListEvent): void {
  isNarrow.value = e.matches;
}
onMounted(() => narrowQuery?.addEventListener('change', onNarrowChange));
onBeforeUnmount(() => narrowQuery?.removeEventListener('change', onNarrowChange));

function artLayout(gameId: string): 'wide' | 'tall' {
  return gameId === 'mahjong_yanbian' && !isNarrow.value ? 'wide' : 'tall';
}

const featureList = [
  { key: 'signin', icon: 'signin', label: 'feature.signin' },
  { key: 'tasks', icon: 'target', label: 'feature.tasks' },
  { key: 'rank', icon: 'trophy', label: 'feature.rank' },
  { key: 'mail', icon: 'mail', label: 'feature.mail' },
  { key: 'announce', icon: 'megaphone', label: 'feature.announce' },
];

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

function openGame(g: GameItem): void {
  if (g.status !== 'online') return;
  pickGame.value = g.gameId;
  if (g.gameId === 'fishing') {
    stages.value = [
      { stageId: 'fishing_novice', name: '珊瑚湾·新手场', minCoins: 1000, baseScore: 10, totalRounds: 0 },
      { stageId: 'fishing_deep', name: '深渊海沟·高手场', minCoins: 50000, baseScore: 100, totalRounds: 0 },
    ];
    showStage.value = true;
    return;
  }
  if (g.gameId === 'slot_fruit') {
    void router.push('/game/slot');
    return;
  }
  stages.value = g.stages;
  showStage.value = true;
}

function startMatch(s: GameItem['stages'][number]): void {
  showStage.value = false;
  if (pickGame.value === 'fishing') {
    void router.push({ path: '/game/fishing', query: { stageId: s.stageId } });
    return;
  }
  const path = pickGame.value === 'mahjong_yanbian' ? '/game/mahjong' : '/game/hongshi';
  void router.push({ path, query: { mode: 'match', stageId: s.stageId } });
}

function openCreate(): void {
  showStage.value = false;
  showCreate.value = true;
}

function createRoom(): void {
  showCreate.value = false;
  const path = pickGame.value === 'hongshi' ? '/game/hongshi' : '/game/mahjong';
  void router.push({
    path,
    query: { mode: 'create', baseScore: createBase.value, totalRounds: createRounds.value, password: createPassword.value || undefined },
  });
}

function joinRoom(): void {
  showJoin.value = false;
  const path = pickGame.value === 'hongshi' ? '/game/hongshi' : '/game/mahjong';
  void router.push({ path, query: { mode: 'join', roomNo: joinNo.value, password: joinPassword.value || undefined } });
}
</script>

<style scoped>
.grid-wrap {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
}
.toprow {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

/* ══ 公告条 ══ */
.notice {
  position: relative;
  flex: 1 1 260px;
  min-width: 220px;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 18px;
  border-radius: 22px;
  background: linear-gradient(90deg, rgba(20, 30, 50, 0.72), rgba(14, 21, 36, 0.5));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    inset 0 0 22px rgba(201, 160, 99, 0.07),
    0 6px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  animation: rise-in 420ms var(--ease-out) both;
}
.n-edge {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid transparent;
  background: linear-gradient(90deg, rgba(201, 160, 99, 0.4), rgba(201, 160, 99, 0.08) 40%, rgba(201, 160, 99, 0.32)) border-box;
  -webkit-mask:
    linear-gradient(#fff 0 0) padding-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.n-ico {
  color: var(--gold-warm);
  display: flex;
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
  color: var(--text-strong);
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

/* ══ 快捷功能卡 ══ */
.features {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
@media (max-width: 900px) {
  .features {
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .features::-webkit-scrollbar {
    display: none;
  }
  .feat {
    flex-shrink: 0;
    width: 96px;
    height: 48px;
  }
}
.feat {
  width: 106px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 15px;
  cursor: pointer;
  background: linear-gradient(160deg, rgba(23, 34, 58, 0.75), rgba(13, 19, 32, 0.72));
  border: 1px solid var(--line-cool);
  box-shadow: var(--edge-inner);
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
  transition:
    transform 180ms var(--ease-out),
    border-color 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out);
  animation: rise-in 420ms var(--ease-out) both;
}
.feat:hover {
  transform: translateY(-3px);
  border-color: rgba(201, 160, 99, 0.45);
  box-shadow:
    var(--edge-inner),
    0 10px 22px rgba(0, 0, 0, 0.4),
    0 0 16px rgba(201, 160, 99, 0.16);
}
.feat:hover .f-plate {
  transform: scale(1.08);
}
.feat:active {
  transform: scale(0.96);
}
.f-plate {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: radial-gradient(circle at 32% 26%, rgba(201, 160, 99, 0.16), rgba(10, 15, 26, 0.9) 76%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -6px 10px rgba(0, 0, 0, 0.4);
  transition: transform 180ms var(--ease-out);
  flex-shrink: 0;
}
.f-label {
  white-space: nowrap;
}

/* ══ 游戏海报卡（非对称：旗舰更宽，单行排布） ══ */
.posters {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (min-width: 1080px) {
  .posters {
    /* 旗舰 1.62fr + 三张 1fr：形成不完全对称的商业大厅节奏 */
    grid-template-columns: 1.62fr 1fr 1fr 1fr;
    grid-auto-rows: clamp(330px, 60vh, 600px);
    gap: 20px;
  }
}

/* ══ 2K / 超宽屏（≥1921px）：整体放大而非留白 ══ */
@media (min-width: 1921px) {
  .grid-wrap {
    max-width: 2120px;
    gap: 24px;
  }
  .toprow {
    gap: 18px;
  }
  .notice {
    height: 62px;
    padding: 0 22px;
    border-radius: 26px;
    gap: 14px;
  }
  .n-text {
    font-size: 15px;
  }
  .n-ico :deep(.appicon) {
    width: 22px;
    height: 22px;
  }
  .features {
    gap: 13px;
  }
  .feat {
    width: 126px;
    height: 62px;
    border-radius: 18px;
    font-size: 15px;
    gap: 10px;
    padding: 0 14px;
  }
  .f-plate {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }
  .f-plate :deep(.appicon) {
    width: 28px;
    height: 28px;
  }
  .posters {
    grid-auto-rows: clamp(330px, 62vh, 780px);
    gap: 26px;
  }
  .poster-card {
    border-radius: 28px;
  }
  .p-body {
    padding: 24px 26px 22px;
  }
  .p-title {
    font-size: 36px;
  }
  .hero .p-title {
    font-size: 54px;
  }
  .p-title.ko {
    font-size: 31px;
  }
  .hero .p-title.ko {
    font-size: 44px;
  }
  .p-sub {
    font-size: 14px;
    margin-top: 7px;
  }
  .hero .p-sub {
    font-size: 15.5px;
  }
  .p-foot {
    margin-top: 16px;
  }
  .p-online {
    font-size: 14px;
  }
  .p-enter {
    font-size: 15px;
  }
  .p-tags {
    top: 18px;
    left: 20px;
  }
  .p-tag {
    font-size: 13px;
    padding: 4px 13px;
    border-radius: 10px;
  }
}
.poster-card {
  position: relative;
  min-height: 248px;
  border-radius: var(--radius-poster);
  overflow: hidden;
  cursor: pointer;
  isolation: isolate;
  border: 1px solid rgba(201, 160, 99, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.14),
    inset 0 -18px 30px rgba(0, 0, 0, 0.36),
    0 22px 50px rgba(0, 0, 0, 0.62),
    0 0 0 1px rgba(0, 0, 0, 0.5);
  transition:
    transform 200ms var(--ease-out),
    box-shadow 200ms var(--ease-out),
    border-color 200ms var(--ease-out);
  animation: rise-in 460ms var(--ease-out) both;
}
.poster-card:hover {
  transform: translateY(-7px);
  border-color: rgba(246, 230, 189, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 214, 0.2),
    inset 0 -18px 30px rgba(0, 0, 0, 0.36),
    0 30px 64px rgba(0, 0, 0, 0.7),
    0 0 34px rgba(201, 160, 99, 0.28);
}
.poster-card:active {
  transform: translateY(-2px) scale(0.985);
}
.p-art {
  position: absolute;
  inset: 0;
  transition: transform 420ms var(--ease-out);
}
.poster-card:hover .p-art {
  transform: scale(1.045);
}
.p-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(4, 8, 14, 0.22) 0%, transparent 30%, transparent 56%, rgba(4, 8, 14, 0.72) 76%, rgba(3, 6, 11, 0.95) 100%);
  pointer-events: none;
}
/* 内嵌金框：渐变描边（遮罩法）+ 内侧暗线，让卡片读成一件“镶金的实物” */
.p-frame {
  position: absolute;
  inset: 9px;
  border-radius: calc(var(--radius-poster) - 8px);
  border: 1px solid transparent;
  background: linear-gradient(158deg, rgba(246, 230, 189, 0.8), rgba(201, 160, 99, 0.24) 34%, rgba(201, 160, 99, 0.16) 66%, rgba(246, 230, 189, 0.7)) border-box;
  -webkit-mask:
    linear-gradient(#fff 0 0) padding-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
}
.p-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  z-index: 2;
  pointer-events: none;
  background-repeat: no-repeat;
  background-size: 26px 26px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'%3E%3Cpath d='M3 15V8a5 5 0 0 1 5-5h7' fill='none' stroke='%23f3dfae' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M8 8l3-3 3 3-3 3z' fill='%23f3dfae'/%3E%3Cpath d='M3 22v-3M22 3h-3' stroke='%23c9a063' stroke-width='1.2' stroke-linecap='round' opacity='.7'/%3E%3C/svg%3E");
  filter: drop-shadow(0 0 4px rgba(201, 160, 99, 0.6));
}
.p-corner.tl {
  top: 6px;
  left: 6px;
}
.p-corner.tr {
  top: 6px;
  right: 6px;
  transform: scaleX(-1);
}
.p-corner.bl {
  bottom: 6px;
  left: 6px;
  transform: scaleY(-1);
}
.p-corner.br {
  bottom: 6px;
  right: 6px;
  transform: scale(-1);
}
.p-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(104deg, transparent 42%, rgba(255, 244, 214, 0.09) 49%, transparent 57%);
  transform: translateX(-130%);
  pointer-events: none;
}
.poster-card:hover .p-sheen {
  transition: transform 900ms var(--ease-out);
  transform: translateX(130%);
}
.p-tags {
  position: absolute;
  top: 14px;
  left: 16px;
  display: flex;
  gap: 6px;
  z-index: 2;
}
.p-tag {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 8px;
  backdrop-filter: blur(4px);
}
.p-tag.rec {
  color: #221904;
  background: linear-gradient(180deg, #f6e6bd, #c9a063);
  box-shadow: 0 4px 12px rgba(201, 160, 99, 0.35);
}
.p-tag.hot {
  color: #ffe9ee;
  background: linear-gradient(180deg, #c8556a, #8f2c3f);
  box-shadow: 0 4px 12px rgba(143, 44, 63, 0.4);
}
.p-body {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18px 20px 17px;
  z-index: 2;
}
.p-title {
  margin: 0;
  /* 站酷小薇（OFL）：衬线展示体，只有 Regular 一档，靠字号与金属渐变撑重量，禁止合成粗体 */
  font-family: var(--font-display-zh);
  font-size: 30px;
  font-weight: 400;
  letter-spacing: 0.12em;
  line-height: 1.1;
  background: linear-gradient(180deg, #fffaf0 0%, #f6e6bd 30%, #d9b46a 52%, #f3dfae 66%, #a8863f 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  /* background-clip:text 下 text-shadow 会盖住字面，改用 drop-shadow 叠出浮雕 + 辉光 */
  filter: drop-shadow(0 1px 0 rgba(58, 38, 8, 0.95)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.72)) drop-shadow(0 0 9px rgba(201, 160, 99, 0.26));
}
.hero .p-title {
  font-size: 46px;
  letter-spacing: 0.16em;
}
.p-title.ko {
  font-family: var(--font-display-ko);
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.04em;
}
.hero .p-title.ko {
  font-size: 38px;
  letter-spacing: 0.06em;
}
.hero .p-sub {
  font-size: 13.5px;
}
.p-sub {
  margin: 7px 0 0;
  font-size: 12px;
  color: var(--gold-champagne);
  opacity: 0.78;
  letter-spacing: 0.06em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}
.p-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.p-online {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--accent-jade);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-jade);
  box-shadow: 0 0 8px rgba(75, 179, 156, 0.85);
  animation: pulse-dot 2.4s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
.p-enter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: var(--gold-champagne);
  opacity: 0;
  transform: translateX(-6px);
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}
.poster-card:hover .p-enter {
  opacity: 1;
  transform: translateX(0);
}
.arw {
  width: 12px;
  height: 12px;
  border-right: 1.6px solid currentColor;
  border-top: 1.6px solid currentColor;
  transform: rotate(45deg);
  display: inline-block;
}
.p-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgba(6, 9, 16, 0.76);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.24em;
}
.poster-card.off {
  cursor: not-allowed;
}

/* 手机竖屏：五张功能卡改为图上字下，一屏排满不再横向裁切 */
@media (max-width: 560px) {
  .features {
    width: 100%;
    overflow: visible;
    gap: 8px;
  }
  .feat {
    flex: 1;
    width: auto;
    min-width: 0;
    height: 56px;
    flex-direction: column;
    gap: 3px;
    padding: 0 2px;
    border-radius: 13px;
    font-size: 10.5px;
  }
  .f-plate {
    width: 25px;
    height: 25px;
    border-radius: 8px;
  }
  .f-plate :deep(.appicon) {
    width: 17px;
    height: 17px;
  }
}

@media (max-width: 720px) {
  .posters {
    gap: 12px;
  }
  .p-sub {
    letter-spacing: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .p-frame {
    inset: 7px;
    border-radius: calc(var(--radius-poster) - 6px);
  }
  .p-corner {
    width: 20px;
    height: 20px;
    background-size: 20px 20px;
  }
  .p-corner.tl,
  .p-corner.tr {
    top: 4px;
  }
  .p-corner.bl,
  .p-corner.br {
    bottom: 4px;
  }
  .p-corner.tl,
  .p-corner.bl {
    left: 4px;
  }
  .p-corner.tr,
  .p-corner.br {
    right: 4px;
  }
  .p-body {
    padding: 12px 13px 12px;
  }
  .p-title,
  .hero .p-title {
    font-size: 22px;
    letter-spacing: 0.06em;
  }
  .p-title.ko,
  .hero .p-title.ko {
    font-size: 19px;
    letter-spacing: 0.02em;
  }
  .p-sub,
  .hero .p-sub {
    font-size: 11px;
    margin-top: 3px;
  }
  .p-foot {
    margin-top: 8px;
  }
  .p-online {
    font-size: 10.5px;
  }
  .p-scrim {
    background: linear-gradient(180deg, rgba(4, 8, 14, 0.2) 0%, transparent 26%, rgba(4, 8, 14, 0.78) 62%, rgba(3, 6, 11, 0.95) 100%);
  }
}

/* ══ 横屏短屏（Android 横屏 960×540 / 16:9 手机横屏 / 平板横屏） ══
   四张海报卡强制单行，行高由剩余空间决定，永不被 Dock 遮挡 */
@media (orientation: landscape) and (max-height: 700px) {
  .grid-wrap {
    flex: 1;
    min-height: 0;
    gap: 10px;
  }
  .toprow {
    flex-wrap: nowrap;
    gap: 10px;
  }
  .notice {
    flex: 1 1 130px;
    min-width: 110px;
    height: 40px;
    padding: 0 13px;
    gap: 9px;
    border-radius: 16px;
  }
  .n-text {
    font-size: 12px;
  }
  .n-ico :deep(.appicon) {
    width: 16px;
    height: 16px;
  }
  .features {
    width: auto;
    overflow: visible;
    gap: 7px;
  }
  .feat {
    width: 80px;
    height: 40px;
    flex-shrink: 0;
    gap: 6px;
    padding: 0 7px;
    border-radius: 12px;
    font-size: 11.5px;
  }
  .f-plate {
    width: 26px;
    height: 26px;
    border-radius: 8px;
  }
  .f-plate :deep(.appicon) {
    width: 18px;
    height: 18px;
  }
  .posters {
    flex: 1;
    min-height: 0;
    grid-template-columns: 1.42fr 1fr 1fr 1fr;
    grid-auto-rows: minmax(0, 1fr);
    gap: 12px;
  }
  .poster-card {
    min-height: 0;
    border-radius: 18px;
  }
  .p-body {
    padding: 11px 13px 11px;
  }
  .p-title {
    font-size: 21px;
    letter-spacing: 0.06em;
  }
  .hero .p-title {
    font-size: 27px;
    letter-spacing: 0.08em;
  }
  .p-title.ko,
  .hero .p-title.ko {
    font-size: 18px;
    letter-spacing: 0.02em;
  }
  .p-sub,
  .hero .p-sub {
    font-size: 10.5px;
    margin-top: 3px;
  }
  .p-foot {
    margin-top: 7px;
  }
  .p-online {
    font-size: 10px;
  }
  .p-tags {
    top: 10px;
    left: 11px;
  }
  .p-tag {
    font-size: 9.5px;
    padding: 2px 7px;
  }
  .p-corner {
    width: 20px;
    height: 20px;
    background-size: 20px 20px;
  }
  .p-sub {
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
/* 极窄横屏（如 667×375）：功能卡回到可横滑 */
@media (orientation: landscape) and (max-height: 430px) {
  .features {
    overflow-x: auto;
    scrollbar-width: none;
  }
  .features::-webkit-scrollbar {
    display: none;
  }
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ══ 弹窗内元素 ══ */
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stage {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 14px;
  cursor: pointer;
  background: linear-gradient(160deg, rgba(23, 34, 58, 0.8), rgba(13, 19, 32, 0.8));
  border: 1px solid var(--line-cool);
  box-shadow: var(--edge-inner);
  transition:
    border-color 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}
.stage:hover {
  border-color: rgba(201, 160, 99, 0.5);
  transform: translateX(2px);
}
.sname {
  font-weight: 700;
  font-size: 15px;
  color: var(--gold-champagne);
}
.sinfo {
  display: flex;
  gap: 14px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.s-arw {
  width: 9px;
  height: 9px;
  border-right: 1.6px solid var(--gold-warm);
  border-top: 1.6px solid var(--gold-warm);
  transform: rotate(45deg);
  opacity: 0.7;
}
.friend-row {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form label {
  font-size: 13px;
  color: var(--text-secondary);
}
.opts {
  display: flex;
  gap: 8px;
}
.opts button {
  flex: 1;
  padding: 9px 0;
  border-radius: 10px;
  border: 1px solid var(--line-cool);
  background: var(--bg-night);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all 160ms var(--ease-out);
}
.opts button.on {
  border-color: var(--gold-warm);
  color: var(--gold-champagne);
  box-shadow: var(--shadow-glow-gold);
}
</style>
