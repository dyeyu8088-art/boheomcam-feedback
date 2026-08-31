<template>
  <div class="grid-wrap">
    <!-- 公告跑马灯 -->
    <div v-if="marquee" class="marquee glass"><span class="lamp">📢</span><span class="mtext">{{ marquee }}</span></div>

    <!-- 功能入口 -->
    <div class="features">
      <button v-for="f in featureList" :key="f.key" class="feat" @click="$emit('openFeature', f.key)">
        <span class="fico">{{ f.icon }}</span><span>{{ t(f.label) }}</span>
      </button>
    </div>

    <!-- 游戏卡片 -->
    <div class="cards">
      <div
        v-for="g in games"
        :key="g.gameId"
        class="card"
        :class="[g.gameId, { off: g.status !== 'online' }]"
        @click="openGame(g)"
      >
        <div class="sheen" />
        <div class="art">{{ gameArt(g.gameId) }}</div>
        <div class="cinfo">
          <div class="cname">
            {{ locale === 'ko' ? g.nameKo : g.name }}
            <span v-if="g.gameId === 'mahjong_yanbian'" class="tag">{{ t('lobby.recommend') }}</span>
            <span v-else-if="g.gameId === 'fishing'" class="tag hot">{{ t('lobby.hot') }}</span>
          </div>
          <div class="cdesc">{{ t(`game.${g.gameId}.desc`) }}</div>
          <div class="conline num">● {{ t('lobby.online', { n: g.online }) }}</div>
        </div>
        <div v-if="g.status !== 'online'" class="mask">{{ t('game.maintenance') }}</div>
      </div>
    </div>

    <!-- 场次选择 -->
    <ModalSheet v-model="showStage" :title="t('lobby.stage.select')">
      <div class="stage-list">
        <div v-for="s in stages" :key="s.stageId" class="stage glass" @click="startMatch(s)">
          <div class="sname">{{ locale === 'ko' ? (s as any).nameKo ?? s.name : s.name }}</div>
          <div class="sinfo">
            <span>{{ t('lobby.stage.base', { n: s.baseScore }) }}</span>
            <span class="smin">{{ t('lobby.stage.min', { n: fmt(s.minCoins) }) }}</span>
          </div>
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
import { onActivated, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import ModalSheet from '../../ui/ModalSheet.vue';
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

const featureList = [
  { key: 'signin', icon: '📅', label: 'feature.signin' },
  { key: 'tasks', icon: '🎯', label: 'feature.tasks' },
  { key: 'rank', icon: '🏆', label: 'feature.rank' },
  { key: 'mail', icon: '✉️', label: 'feature.mail' },
  { key: 'announce', icon: '📣', label: 'feature.announce' },
];

const gameArt = (id: string): string =>
  ({ mahjong_yanbian: '🀄', hongshi: '🃏', fishing: '🐠', slot_fruit: '🍒' })[id] ?? '🎮';

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
  gap: 14px;
  max-width: 760px;
  margin: 0 auto;
}
.marquee {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  white-space: nowrap;
}
.mtext {
  animation: scrollx 18s linear infinite;
}
@keyframes scrollx {
  0% {
    transform: translateX(30%);
  }
  100% {
    transform: translateX(-100%);
  }
}
.features {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px;
}
.feat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--bg-charcoal);
  border: 1px solid var(--line-soft);
  color: var(--text-secondary);
  border-radius: 14px;
  padding: 10px 0;
  min-width: 64px;
  flex: 1;
  cursor: pointer;
  font-size: 11px;
  transition: transform var(--dur-micro) var(--ease-out);
}
.feat:active {
  transform: scale(0.95);
}
.fico {
  font-size: 20px;
}
.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (min-width: 700px) {
  .cards {
    grid-template-columns: repeat(4, 1fr);
  }
}
.card {
  position: relative;
  border-radius: var(--radius-card);
  padding: 18px 16px 14px;
  min-height: 168px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--line-soft);
  box-shadow: var(--shadow-card);
  transition:
    transform var(--dur-micro) var(--ease-out),
    box-shadow var(--dur-micro) var(--ease-out);
}
.card:hover {
  transform: translateY(-3px);
  box-shadow:
    var(--shadow-card),
    var(--shadow-glow-gold);
}
.card:active {
  transform: scale(0.97);
}
.card.mahjong_yanbian {
  background: linear-gradient(155deg, #233043 0%, #151b28 70%);
}
.card.hongshi {
  background: linear-gradient(155deg, #33232c 0%, #171420 70%);
}
.card.fishing {
  background: linear-gradient(155deg, #16323e 0%, #101a24 70%);
}
.card.slot_fruit {
  background: linear-gradient(155deg, #33301f 0%, #181509 70%);
}
.sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(230, 207, 163, 0.07) 48%, transparent 56%);
  transform: translateX(-120%);
  animation: sheen 5.5s ease-in-out infinite;
}
@keyframes sheen {
  0%,
  55% {
    transform: translateX(-120%);
  }
  75%,
  100% {
    transform: translateX(120%);
  }
}
.art {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: 52px;
  opacity: 0.9;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5));
  animation: float-slow 5s ease-in-out infinite;
}
.cname {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tag {
  font-size: 10px;
  font-weight: 700;
  color: #14100a;
  background: var(--gold-warm);
  border-radius: 6px;
  padding: 1px 6px;
}
.tag.hot {
  background: var(--accent-crimson);
  color: #ffe7ec;
}
.cdesc {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 3px;
}
.conline {
  font-size: 11px;
  color: var(--accent-jade);
  margin-top: 8px;
}
.mask {
  position: absolute;
  inset: 0;
  background: rgba(8, 10, 14, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.2em;
}
.card.off {
  cursor: not-allowed;
}
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stage {
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color var(--dur-micro);
}
.stage:hover {
  border-color: var(--gold-warm);
}
.sname {
  font-weight: 700;
  font-size: 15px;
  color: var(--gold-champagne);
}
.sinfo {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
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
  border: 1px solid var(--line-soft);
  background: var(--bg-night);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
}
.opts button.on {
  border-color: var(--gold-warm);
  color: var(--gold-champagne);
  box-shadow: var(--shadow-glow-gold);
}
</style>
