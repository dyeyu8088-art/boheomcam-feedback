<template>
  <div class="lobby" :class="{ 'menu-open': menuOpen }">
    <LobbyBackdrop />

    <!-- ══ 顶栏：左 玩家 / 中 HTML Logo / 右 金币 · 钻石 · 语言 · 设置 · 菜单（竖屏） ══ -->
    <header class="topbar">
      <PlayerProfile
        :nickname="displayName(me?.nickname) || '—'"
        :uid="me?.uid ?? ''"
        :level="me?.level ?? 1"
        :vip="me?.vip ?? 0"
        :avatar-id="me?.avatarId ?? 1"
        :show-exp="false"
        class="tb-profile"
        :aria-label="t('aria.profile')"
        @click="showMe = true"
      />
      <LobbyLogo class="brand" size="md" />
      <div class="assets">
        <div class="coinwrap">
          <CurrencyBar kind="coin" :value="me?.coins ?? 0" addable :aria-label="t('aria.coins')" @add="tab = 'shop'" />
          <span class="coin-burst" aria-hidden="true"><i v-for="p in particles" :key="p.id" class="cp" :style="p.style" /></span>
        </div>
        <CurrencyBar kind="diamond" :value="me?.diamonds ?? 0" addable :aria-label="t('aria.diamonds')" class="tb-gem" @add="tab = 'shop'" />
        <button class="lang" type="button" :aria-label="t('aria.language')" :title="t('settings.language')" @click="toggleLocale">
          <span class="lang-cur">{{ locale === 'ko' ? '한' : '中' }}</span>
          <span class="lang-alt">{{ locale === 'ko' ? '中' : '한' }}</span>
        </button>
        <GameButton round size="md" :art="settingsArt" :aria-label="t('aria.settings')" :title="t('settings.title')" class="tb-gear" @click="showSettings = true" />
        <button class="menu-btn" type="button" :aria-label="menuOpen ? t('aria.closeMenu') : t('aria.menu')" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><i /><i /><i /></button>
      </div>
    </header>

    <!-- ══ 公告栏：喇叭 + 自动滚动（无公告时显示欢迎语） ══ -->
    <div class="notice" role="status" :aria-label="t('aria.notice')">
      <img class="n-ico" :src="megaphone" alt="" draggable="false" />
      <div class="n-track"><span :key="marquee" class="n-text motion-loop">{{ marquee }}</span></div>
    </div>

    <!-- ══ 主体：内容区 + 右侧快捷（竖屏为抽屉） ══ -->
    <div class="body">
      <main class="content">
        <keep-alive>
          <GameGrid v-if="tab === 'lobby'" @enter="enterGame" />
          <GamesPanel v-else-if="tab === 'games'" @open="tab = 'lobby'" />
          <FriendsPanel v-else-if="tab === 'friends'" />
          <InventoryPanel v-else-if="tab === 'bag'" />
          <ShopPanel v-else-if="tab === 'shop'" />
          <ActivityPanel v-else-if="tab === 'activity'" />
          <TournamentPanel v-else-if="tab === 'tournament'" />
        </keep-alive>
      </main>
      <aside class="side" :class="{ open: menuOpen }" :aria-label="t('lobby.menu')">
        <button class="side-close" type="button" :aria-label="t('aria.closeMenu')" @click="menuOpen = false">×</button>
        <button v-for="f in quickList" :key="f.key" class="feat" type="button" :aria-label="t(f.label)" @click="openFeature(f.key)">
          <img class="f-ico" :src="f.icon" alt="" draggable="false" />
          <span class="f-label">{{ t(f.label) }}</span>
          <span v-if="f.key === 'mail' && unreadMail > 0" class="f-badge num" :aria-label="`${unreadMail}`">{{ unreadMail }}</span>
          <span v-if="f.key === 'support' && supportUnread > 0" class="f-badge num">{{ supportUnread }}</span>
        </button>
        <button class="feat more" type="button" :aria-label="t('lobby.more')" @click="showMore = true">
          <span class="f-more-ico" aria-hidden="true"><i /><i /><i /></span>
          <span class="f-label">{{ t('lobby.more') }}</span>
        </button>
      </aside>
      <div v-if="menuOpen" class="scrim" @click="menuOpen = false" />
    </div>

    <!-- ══ 底部导航（5）：大厅 / 游戏 / 好友 / 背包 / 商店 ══ -->
    <GameNavbar v-model="tab" :items="navs" class="navbar" />

    <!-- 更多：VIP / 排行 / 公告 / 福利 / 比赛 -->
    <GamePopup v-model="showMore" :title="t('lobby.more')" skin="blue" size="sm">
      <div class="more-grid">
        <button v-for="m in moreList" :key="m.key" class="more-item" type="button" :aria-label="t(m.label)" @click="openMore(m.key)">
          <img class="m-ico" :src="m.icon" alt="" draggable="false" />
          <span>{{ t(m.label) }}</span>
        </button>
      </div>
    </GamePopup>

    <!-- 设置 -->
    <GamePopup v-model="showSettings" :title="t('settings.title')" skin="blue" size="sm">
      <div class="set-row">
        <span>{{ t('settings.language') }}</span>
        <div class="seg">
          <GameButton size="sm" :variant="locale === 'zh' ? 'gold' : 'dark'" @click="setLocale('zh')">{{ t('lobby.langZh') }}</GameButton>
          <GameButton size="sm" :variant="locale === 'ko' ? 'gold' : 'dark'" @click="setLocale('ko')">{{ t('lobby.langKo') }}</GameButton>
        </div>
      </div>
      <div class="set-row">
        <span>{{ t('settings.music') }}</span>
        <GameToggle :model-value="audioState.music" @update:model-value="setAudio({ music: $event })" />
      </div>
      <div class="set-row">
        <span>{{ t('settings.sfx') }}</span>
        <GameToggle :model-value="audioState.sfx" @update:model-value="setAudio({ sfx: $event })" />
      </div>
      <div class="set-row">
        <span>{{ t('settings.volume') }}</span>
        <input class="range" type="range" min="0" max="100" :aria-label="t('settings.volume')" :value="Math.round(audioState.musicVolume * 100)" @input="setAudio({ musicVolume: Number(($event.target as HTMLInputElement).value) / 100, sfxVolume: Math.min(1, Number(($event.target as HTMLInputElement).value) / 100 + 0.4) })" />
      </div>
      <div class="set-row">
        <span>{{ t('settings.reduceMotion') }}</span>
        <GameToggle :model-value="reduceMotion" @update:model-value="setReduceMotion($event)" />
      </div>
      <div class="set-row">
        <span>{{ t('settings.uid') }}</span>
        <span class="num dim">{{ me?.uid }}</span>
      </div>
      <template #footer>
        <GameButton variant="red" size="md" @click="logout">{{ t('settings.logout') }}</GameButton>
      </template>
    </GamePopup>

    <GamePopup v-model="showMe" :title="t('nav.me')" skin="blue" size="lg">
      <MePanel @logout="logout" />
      <template #footer>
        <GameButton variant="gold" size="md" @click="((showMe = false), (showVip = true))">{{ t('feature.vip') }}</GameButton>
      </template>
    </GamePopup>

    <VipPopup v-model="showVip" />
    <FeatureModals ref="features" />
    <SupportPanel v-model="showSupport" />
    <LoadingScreen ref="loader" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import { api } from '../net/api.js';
import { t, setLocale, currentLocale } from '../i18n/index.js';
import { displayName } from '../i18n/names.js';
import { asset, GAME_PRELOAD } from '../assets/assets.js';
import { audio } from '../audio/AudioManager.js';
import { reduceMotion, setReduceMotion } from '../design/motion.js';
import LobbyBackdrop from './lobby/LobbyBackdrop.vue';
import GameGrid, { type EnterRequest } from './lobby/GameGrid.vue';
import GamesPanel from './lobby/GamesPanel.vue';
import TournamentPanel from './lobby/TournamentPanel.vue';
import ActivityPanel from './lobby/ActivityPanel.vue';
import FriendsPanel from './lobby/FriendsPanel.vue';
import InventoryPanel from './lobby/InventoryPanel.vue';
import ShopPanel from './lobby/ShopPanel.vue';
import MePanel from './lobby/MePanel.vue';
import VipPopup from './lobby/VipPopup.vue';
import FeatureModals from './lobby/FeatureModals.vue';
import SupportPanel from './lobby/SupportPanel.vue';
import LobbyLogo from '../ui/LobbyLogo.vue';
import PlayerProfile from '../ui/PlayerProfile.vue';
import CurrencyBar from '../ui/CurrencyBar.vue';
import GameButton from '../ui/GameButton.vue';
import GameToggle from '../ui/GameToggle.vue';
import GameNavbar from '../ui/GameNavbar.vue';
import GamePopup from '../ui/GamePopup.vue';
import LoadingScreen from '../ui/LoadingScreen.vue';

const router = useRouter();
const user = useUserStore();
const me = computed(() => user.me);
const locale = currentLocale;
type Tab = 'lobby' | 'games' | 'friends' | 'bag' | 'shop' | 'activity' | 'tournament';
const tab = ref<Tab>('lobby');
const showSettings = ref(false);
const showMe = ref(false);
const showVip = ref(false);
const showMore = ref(false);
const showSupport = ref(false);
const menuOpen = ref(false);
const unreadMail = ref(0);
const supportUnread = ref(0);
const features = ref<InstanceType<typeof FeatureModals> | null>(null);
const loader = ref<InstanceType<typeof LoadingScreen> | null>(null);
const settingsArt = asset('common', 'btnSettingsRound');
const megaphone = asset('common', 'iconMegaphoneRound');

/** 底部导航 5 项 */
const navs = computed(() => [
  { key: 'lobby', icon: asset('common', 'navIconHome'), label: t('nav.lobby') },
  { key: 'games', icon: asset('common', 'navIconMahjong'), label: t('nav.games') },
  { key: 'friends', icon: asset('common', 'navIconFriends'), label: t('nav.friends') },
  { key: 'bag', icon: asset('common', 'navIconBag'), label: t('nav.bag') },
  { key: 'shop', icon: asset('common', 'iconAncientCoinRound'), label: t('nav.shop') },
]);
/** 右侧快捷 4 项 + 更多 */
const quickList = [
  { key: 'activity', icon: asset('common', 'iconGiftRound'), label: 'feature.activity' },
  { key: 'tasks', icon: asset('common', 'iconTaskRound'), label: 'feature.tasks' },
  { key: 'mail', icon: asset('common', 'iconMailRound'), label: 'feature.mail' },
  { key: 'support', icon: asset('common', 'iconChatRound'), label: 'feature.service' },
];
const moreList = [
  { key: 'vip', icon: asset('common', 'iconCrownRound'), label: 'feature.vip' },
  { key: 'rank', icon: asset('common', 'navIconRank'), label: 'feature.rank' },
  { key: 'announce', icon: asset('common', 'iconMegaphoneRound'), label: 'feature.announce' },
  { key: 'signin', icon: asset('common', 'iconDailyBonusBag'), label: 'feature.welfare' },
  { key: 'tournament', icon: asset('common', 'navIconTrophy'), label: 'nav.tournament' },
];

/* 公告：服务器公告 → 无则欢迎语；随语言切换 */
const announcements = ref<{ title: string; title_ko: string }[]>([]);
const marquee = computed(() => {
  const a = announcements.value[0];
  if (!a) return t('lobby.notice.welcome');
  return locale.value === 'ko' ? a.title_ko || a.title : a.title;
});

/* 音频设置（响应式镜像） */
const audioState = reactive({ ...audio.settings });
function setAudio(patch: Partial<typeof audioState>): void {
  audio.update(patch);
  Object.assign(audioState, audio.settings);
}
function toggleLocale(): void {
  setLocale(locale.value === 'ko' ? 'zh' : 'ko');
  audio.sfx('tab');
}

/* 金币粒子：余额增加时从金币栏迸出（减少动态时跳过） */
const particles = ref<{ id: number; style: Record<string, string> }[]>([]);
let pseq = 0;
watch(
  () => me.value?.coins ?? 0,
  (now, before) => {
    if (before === undefined || now <= before || reduceMotion.value) return;
    const n = now - before >= 10000 ? 14 : 8;
    const batch: { id: number; style: Record<string, string> }[] = Array.from({ length: n }, () => ({
      id: ++pseq,
      style: { '--dx': `${Math.round(-40 + Math.random() * 80)}px`, '--dy': `${Math.round(-70 - Math.random() * 50)}px`, '--dl': `${Math.round(Math.random() * 180)}ms`, '--sz': `${6 + Math.round(Math.random() * 6)}px` },
    }));
    particles.value = [...particles.value, ...batch];
    setTimeout(() => {
      particles.value = particles.value.filter((p) => !batch.includes(p));
    }, 1200);
  },
);

onMounted(() => {
  if (!user.me) void user.loadMe();
  void user.loadBrand();
  audio.setScene('lobby');
  void loadUnread();
  void loadAnnouncements();
});
async function loadAnnouncements(): Promise<void> {
  try {
    const a = await api<{ items: { title: string; title_ko: string }[] }>('/api/v1/announcements');
    announcements.value = a.items;
  } catch {
    /* 无公告时显示欢迎语 */
  }
}
async function loadUnread(): Promise<void> {
  try {
    const d = await api<{ items: { read_at: string | null }[] }>('/api/v1/mail');
    unreadMail.value = d.items.filter((m) => !m.read_at).length;
  } catch {
    /* noop */
  }
  try {
    const s = await api<{ items: { status: string; last_reply_by: string }[] }>('/api/v1/support/tickets');
    supportUnread.value = s.items.filter((x) => x.status === 'answered' && x.last_reply_by === 'admin').length;
  } catch {
    /* noop */
  }
}
function openFeature(key: string): void {
  menuOpen.value = false;
  if (key === 'signin' || key === 'tasks' || key === 'activity') tab.value = 'activity';
  else if (key === 'vip') showVip.value = true;
  else if (key === 'support') {
    showSupport.value = true;
    setTimeout(() => void loadUnread(), 1500);
  } else {
    features.value?.open(key);
    if (key === 'mail') setTimeout(() => void loadUnread(), 1500);
  }
}
function openMore(key: string): void {
  showMore.value = false;
  if (key === 'tournament') tab.value = 'tournament';
  else openFeature(key);
}
/** 进入游戏：先做真实资源预加载（按字节进度），再路由；退出游戏回大厅由各游戏 exit() 负责 */
async function enterGame(req: EnterRequest): Promise<void> {
  const groups = GAME_PRELOAD[req.gameId] ?? ['common'];
  await loader.value?.load(groups, req.name);
  audio.setScene('none');
  void router.push({ path: req.path, query: req.query as Record<string, string> });
}
async function logout(): Promise<void> {
  await user.logout();
  void router.replace('/login');
}
</script>

<style scoped>
.lobby {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-abyss);
}
/* ══ 顶栏 ══ */
.topbar {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: calc(var(--safe-top) + 10px) max(var(--safe-right), 22px) 8px max(var(--safe-left), 22px);
  animation: fade-down 420ms var(--ease-out) both;
}
.brand {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  margin-top: calc(var(--safe-top) / 2);
}
.assets {
  display: flex;
  align-items: center;
  gap: 10px;
}
.coinwrap {
  position: relative;
}
.coin-burst {
  position: absolute;
  left: 14px;
  top: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}
.cp {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--sz, 8px);
  height: var(--sz, 8px);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff6c8, #f5c04a 55%, #b8791c);
  box-shadow: 0 0 6px rgba(255, 220, 120, 0.8);
  animation: coin-pop 900ms var(--ease-out) var(--dl, 0ms) both;
}
@keyframes coin-pop {
  0% {
    transform: translate(0, 0) scale(0.4);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) scale(1);
    opacity: 0;
  }
}
.lang {
  height: 40px;
  min-width: 46px;
  padding: 0 8px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(20, 45, 110, 0.9), rgba(6, 18, 56, 0.95));
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 3px #f0c14e,
    0 4px 10px rgba(0, 0, 0, 0.45);
  color: #fff3c4;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  transition: transform 120ms var(--ease-out);
}
.lang:hover {
  transform: translateY(-1px);
}
.lang:active {
  transform: scale(0.94);
}
.lang:focus-visible,
.menu-btn:focus-visible,
.feat:focus-visible {
  outline: 3px solid #ffe28a;
  outline-offset: 2px;
}
.lang-cur {
  font-size: 16px;
}
.lang-alt {
  font-size: 11px;
  opacity: 0.55;
}
.menu-btn {
  display: none;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(20, 45, 110, 0.9), rgba(6, 18, 56, 0.95));
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 3px #f0c14e;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}
.menu-btn i {
  width: 18px;
  height: 2.5px;
  border-radius: 2px;
  background: #ffe28a;
}
/* ══ 公告栏 ══ */
.notice {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  margin: 0 max(var(--safe-right), 22px) 6px max(var(--safe-left), 22px);
  padding: 0 14px 0 6px;
  border-radius: 20px;
  background: linear-gradient(90deg, rgba(8, 20, 60, 0.85), rgba(4, 10, 34, 0.55));
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 3px #f0c14e,
    0 6px 18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  animation: rise-in 420ms var(--ease-out) both;
}
.n-ico {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}
.n-track {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
}
.n-text {
  display: inline-block;
  padding-left: 100%;
  font-size: 13px;
  color: #fff3c4;
  letter-spacing: 0.02em;
  animation: notice-scroll 22s linear infinite;
}
@keyframes notice-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}
:global(html.reduce-motion) .n-text {
  padding-left: 0;
}
/* ══ 主体 ══ */
.body {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  padding: 0 max(var(--safe-right), 22px) 0 max(var(--safe-left), 22px);
}
.content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 4px 10px;
  scrollbar-width: thin;
}
.side {
  flex-shrink: 0;
  width: 88px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: none;
  padding-bottom: 8px;
}
.side::-webkit-scrollbar {
  display: none;
}
.side-close {
  display: none;
}
.scrim {
  display: none;
}
.feat {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(20, 45, 110, 0.85), rgba(6, 18, 56, 0.9));
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 3px #f0c14e,
    0 6px 14px rgba(0, 0, 0, 0.45);
  color: #fff;
  font: inherit;
  cursor: pointer;
  transition: transform 140ms var(--ease-out), box-shadow 140ms;
  animation: rise-in 420ms var(--ease-out) both;
}
.feat:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 3px #ffe28a,
    0 0 16px rgba(240, 193, 78, 0.35),
    0 6px 14px rgba(0, 0, 0, 0.45);
}
.feat:active {
  transform: scale(0.94);
}
.f-ico {
  width: 56px;
  height: 56px;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55));
}
.f-more-ico {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.f-more-ico i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff6c8, #f5c04a 55%, #b8791c);
}
.f-label {
  font-size: 12px;
  font-weight: 800;
  text-shadow: var(--sk-outline);
  white-space: nowrap;
}
.f-badge {
  position: absolute;
  top: 2px;
  right: 6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: linear-gradient(180deg, #ff6b5a, #c8161a);
  box-shadow: 0 0 0 2px #ffe28a;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
/* ══ 底部导航 ══ */
.navbar {
  position: relative;
  z-index: 3;
  margin: 6px auto 0;
  width: min(760px, calc(100% - 40px));
  margin-bottom: calc(var(--safe-bottom) + 8px);
  animation: rise-in 420ms var(--ease-out) both;
}
/* 更多 */
.more-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.more-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(240, 193, 78, 0.3);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 120ms var(--ease-out);
}
.more-item:hover {
  background: rgba(255, 255, 255, 0.1);
}
.more-item:active {
  transform: scale(0.95);
}
.m-ico {
  width: 54px;
  height: 54px;
  object-fit: contain;
}
/* 设置 */
.set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 14px;
}
.seg {
  display: flex;
  gap: 8px;
}
.range {
  width: 160px;
  accent-color: #f8c74a;
}
.dim {
  color: #9fb4e8;
}
/* ══ 响应式 ══ */
@media (max-width: 1100px) {
  .brand :deep(.text) {
    display: none;
  }
}
/* 手机横屏（高度 ≤ 450）：顶栏 / 公告 / 功能栏压扁，功能栏只留图标 */
@media (orientation: landscape) and (max-height: 450px) {
  .topbar {
    padding-top: calc(var(--safe-top) + 2px);
    padding-bottom: 2px;
    gap: 6px;
  }
  .tb-profile {
    --h: 40px;
  }
  .brand {
    --h: 32px;
  }
  .assets {
    gap: 6px;
  }
  .assets :deep(.cb) {
    --h: 30px;
  }
  .lang {
    height: 30px;
    min-width: 36px;
  }
  .tb-gear {
    --h: 30px;
  }
  .notice {
    height: 26px;
    margin-bottom: 3px;
  }
  .n-ico {
    width: 20px;
    height: 20px;
  }
  .n-text {
    font-size: 11px;
  }
  .body {
    gap: 6px;
  }
  .content {
    padding: 2px 2px 4px;
  }
  .side {
    width: 46px;
    gap: 4px;
  }
  .feat {
    padding: 3px 2px;
    border-radius: 10px;
  }
  .f-ico,
  .f-more-ico {
    width: 34px;
    height: 34px;
  }
  .f-label {
    display: none;
  }
  .navbar {
    width: min(560px, calc(100% - 24px));
    margin-top: 3px;
    margin-bottom: calc(var(--safe-bottom) + 2px);
    --h: 36px;
  }
  .navbar :deep(.gn-item) {
    --h: 36px;
    font-size: 12px;
    min-width: 0;
    padding: 0 8px;
  }
}
/* 竖屏 / 窄屏：单列滚动，右侧菜单变抽屉，底栏固定 */
@media (max-width: 720px), (orientation: portrait) {
  .topbar {
    gap: 8px;
    padding-left: max(var(--safe-left), 12px);
    padding-right: max(var(--safe-right), 12px);
  }
  .tb-profile {
    --h: 46px;
  }
  .brand {
    position: static;
    transform: none;
    margin: 0 auto;
    --h: 36px;
  }
  .assets {
    gap: 6px;
  }
  .assets :deep(.cb) {
    --h: 30px;
  }
  .tb-gem,
  .tb-gear {
    display: none;
  }
  .lang {
    height: 32px;
    min-width: 38px;
    padding: 0 6px;
  }
  .menu-btn {
    display: flex;
  }
  .notice {
    margin-left: max(var(--safe-left), 12px);
    margin-right: max(var(--safe-right), 12px);
    height: 34px;
  }
  .body {
    padding: 0 max(var(--safe-right), 12px) 0 max(var(--safe-left), 12px);
    gap: 0;
  }
  .content {
    padding-bottom: 16px;
  }
  .side {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    width: 120px;
    padding: calc(var(--safe-top) + 12px) 12px calc(var(--safe-bottom) + 12px);
    background: linear-gradient(180deg, rgba(8, 20, 60, 0.96), rgba(4, 10, 34, 0.98));
    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.6);
    transform: translateX(105%);
    transition: transform 240ms var(--ease-out);
  }
  .side.open {
    transform: translateX(0);
  }
  .side-close {
    display: block;
    align-self: flex-end;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 20px;
    line-height: 32px;
    cursor: pointer;
  }
  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(0, 0, 0, 0.45);
  }
  .navbar {
    position: sticky;
    bottom: 0;
    width: calc(100% - 24px);
    margin: 4px auto calc(var(--safe-bottom) + 6px);
  }
  .navbar :deep(.gn-item) {
    --h: 46px;
    min-width: 0;
    padding: 0 4px;
    font-size: 11px;
    gap: 3px;
  }
  .navbar :deep(.gn-icon) {
    height: 26px;
  }
}
@media (max-width: 400px) {
  .assets :deep(.cb) {
    --h: 28px;
  }
  .tb-profile {
    --h: 42px;
  }
  .brand :deep(.emblem) {
    width: 32px;
    height: 32px;
  }
}
</style>
