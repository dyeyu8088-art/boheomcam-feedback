<template>
  <div class="lobby">
    <LobbyBackdrop />

    <!-- ══ 顶栏：玩家资料 / 品牌 / 资产 + 设置 ══ -->
    <header class="topbar">
      <PlayerProfile
        :nickname="me?.nickname ?? '—'"
        :uid="me?.uid ?? ''"
        :level="me?.level ?? 1"
        :vip="me?.vip ?? 0"
        :avatar-id="me?.avatarId ?? 1"
        :show-exp="false"
        class="tb-profile"
        @click="showMe = true"
      />
      <div class="brand">
        <svg class="b-mark" viewBox="0 0 44 44">
          <defs>
            <linearGradient id="bmG" x1="0.15" y1="0" x2="0.85" y2="1">
              <stop offset="0" stop-color="#fff2c4" />
              <stop offset="0.5" stop-color="#f5c04a" />
              <stop offset="1" stop-color="#9a6416" />
            </linearGradient>
          </defs>
          <circle cx="22" cy="22" r="19.5" fill="none" stroke="url(#bmG)" stroke-width="1.6" opacity="0.95" />
          <circle cx="22" cy="22" r="15.5" fill="none" stroke="url(#bmG)" stroke-width="0.8" opacity="0.5" />
          <path d="M9 27 L16.5 17.5 L20.5 22.5 L25.5 15 L32 24 L35 20.5 L38 27" fill="none" stroke="url(#bmG)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="25.5" cy="10.5" r="3.2" fill="none" stroke="url(#bmG)" stroke-width="1.4" />
          <path d="M13 31 h18" stroke="url(#bmG)" stroke-width="1.1" stroke-linecap="round" opacity="0.7" />
        </svg>
        <div class="b-text">
          <span class="b-cn" :class="{ ko: locale === 'ko' }">{{ locale === 'ko' ? user.brand.nameKo : user.brand.nameZh }}</span>
          <span class="b-en">{{ user.brand.nameEn }}</span>
        </div>
      </div>
      <div class="assets">
        <CurrencyBar kind="coin" :value="me?.coins ?? 0" addable @add="tab = 'shop'" />
        <CurrencyBar kind="diamond" :value="me?.diamonds ?? 0" addable @add="tab = 'shop'" />
        <GameButton round size="md" :art="settingsArt" :title="t('settings.title')" class="tb-gear" @click="showSettings = true" />
      </div>
    </header>

    <!-- ══ 主体：内容区 + 功能侧栏 ══ -->
    <div class="body">
      <main class="content">
        <keep-alive>
          <GameGrid v-if="tab === 'lobby'" @enter="enterGame" />
          <GamesPanel v-else-if="tab === 'games'" @open="tab = 'lobby'" />
          <TournamentPanel v-else-if="tab === 'tournament'" />
          <FriendsPanel v-else-if="tab === 'friends'" />
          <InventoryPanel v-else-if="tab === 'bag'" />
          <ShopPanel v-else-if="tab === 'shop'" />
          <ActivityPanel v-else-if="tab === 'activity'" />
        </keep-alive>
      </main>
      <aside class="side">
        <button v-for="f in featureList" :key="f.key" class="feat" type="button" @click="openFeature(f.key)">
          <img class="f-ico" :src="f.icon" alt="" draggable="false" />
          <span class="f-label">{{ t(f.label) }}</span>
          <span v-if="f.key === 'mail' && unreadMail > 0" class="f-badge num">{{ unreadMail }}</span>
        </button>
      </aside>
    </div>

    <!-- ══ 底部导航 ══ -->
    <GameNavbar v-model="tab" :items="navs" class="navbar" />

    <!-- 设置 -->
    <GamePopup v-model="showSettings" :title="t('settings.title')" skin="blue" size="sm">
      <div class="set-row">
        <span>{{ t('settings.language') }}</span>
        <div class="seg">
          <GameButton size="sm" :variant="locale === 'zh' ? 'gold' : 'dark'" @click="setLocale('zh')">中文</GameButton>
          <GameButton size="sm" :variant="locale === 'ko' ? 'gold' : 'dark'" @click="setLocale('ko')">한국어</GameButton>
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
        <input class="range" type="range" min="0" max="100" :value="Math.round(audioState.musicVolume * 100)" @input="setAudio({ musicVolume: Number(($event.target as HTMLInputElement).value) / 100, sfxVolume: Math.min(1, Number(($event.target as HTMLInputElement).value) / 100 + 0.4) })" />
      </div>
      <div class="set-row">
        <span>{{ t('settings.uid') }}</span>
        <span class="num dim">{{ me?.uid }}</span>
      </div>
      <template #footer>
        <GameButton variant="red" size="md" @click="logout">{{ t('settings.logout') }}</GameButton>
      </template>
    </GamePopup>

    <!-- 我的 -->
    <GamePopup v-model="showMe" :title="t('nav.me')" skin="blue" size="lg">
      <MePanel @logout="logout" />
      <template #footer>
        <GameButton variant="gold" size="md" @click="((showMe = false), (showVip = true))">{{ t('feature.vip') }}</GameButton>
      </template>
    </GamePopup>

    <VipPopup v-model="showVip" />
    <FeatureModals ref="features" />
    <LoadingScreen ref="loader" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import { api } from '../net/api.js';
import { t, setLocale, currentLocale } from '../i18n/index.js';
import { asset, GAME_PRELOAD } from '../assets/assets.js';
import { audio } from '../audio/AudioManager.js';
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
type Tab = 'lobby' | 'games' | 'tournament' | 'friends' | 'bag' | 'shop' | 'activity';
const tab = ref<Tab>('lobby');
const showSettings = ref(false);
const showMe = ref(false);
const showVip = ref(false);
const unreadMail = ref(0);
const features = ref<InstanceType<typeof FeatureModals> | null>(null);
const loader = ref<InstanceType<typeof LoadingScreen> | null>(null);
const settingsArt = asset('common', 'btnSettingsRound');

const navs = computed(() => [
  { key: 'lobby', icon: asset('common', 'navIconHome'), label: t('nav.lobby') },
  { key: 'games', icon: asset('common', 'navIconMahjong'), label: t('nav.games') },
  { key: 'tournament', icon: asset('common', 'navIconTrophy'), label: t('nav.tournament') },
  { key: 'friends', icon: asset('common', 'navIconFriends'), label: t('nav.friends') },
  { key: 'bag', icon: asset('common', 'navIconBag'), label: t('nav.bag') },
  { key: 'shop', icon: asset('common', 'iconShopIngot'), label: t('nav.shop') },
]);
const featureList = [
  { key: 'activity', icon: asset('common', 'iconEventGift'), label: 'feature.activity' },
  { key: 'signin', icon: asset('common', 'iconDailyBonusBag'), label: 'feature.welfare' },
  { key: 'tasks', icon: asset('common', 'iconTaskScroll'), label: 'feature.tasks' },
  { key: 'mail', icon: asset('common', 'iconMail'), label: 'feature.mail' },
  { key: 'rank', icon: asset('common', 'navIconRank'), label: 'feature.rank' },
  { key: 'announce', icon: asset('common', 'iconMegaphoneRound'), label: 'feature.announce' },
  { key: 'vip', icon: asset('common', 'iconVipCrown'), label: 'feature.vip' },
];

/* 音频设置（响应式镜像） */
const audioState = reactive({ ...audio.settings });
function setAudio(patch: Partial<typeof audioState>): void {
  audio.update(patch);
  Object.assign(audioState, audio.settings);
}

onMounted(() => {
  if (!user.me) void user.loadMe();
  void user.loadBrand();
  audio.setScene('lobby');
  void loadUnread();
});
async function loadUnread(): Promise<void> {
  try {
    const d = await api<{ items: { read_at: string | null }[] }>('/api/v1/mail');
    unreadMail.value = d.items.filter((m) => !m.read_at).length;
  } catch {
    /* noop */
  }
}
function openFeature(key: string): void {
  if (key === 'signin' || key === 'tasks' || key === 'activity') tab.value = 'activity';
  else if (key === 'vip') showVip.value = true;
  else {
    features.value?.open(key);
    if (key === 'mail') setTimeout(() => void loadUnread(), 1500);
  }
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
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: calc(var(--safe-top) + 12px) max(var(--safe-right), 22px) 10px max(var(--safe-left), 22px);
  animation: fade-down 420ms var(--ease-out) both;
}
.brand {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 11px;
  pointer-events: none;
}
.b-mark {
  width: 42px;
  height: 42px;
  filter: drop-shadow(0 2px 10px rgba(245, 192, 74, 0.4));
}
.b-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.b-cn {
  font-family: var(--font-display-zh);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.34em;
  line-height: 1;
  background: linear-gradient(180deg, #fff6d5 0%, #ffd867 45%, #f39a1e 60%, #ffe28a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 #5a3305) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.6));
}
.b-cn.ko {
  font-family: var(--font-display-ko);
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.12em;
}
.b-en {
  font-family: var(--font-brand);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.4em;
  color: #f5c04a;
  opacity: 0.85;
}
.assets {
  display: flex;
  align-items: center;
  gap: 12px;
}
/* ══ 主体 ══ */
.body {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 14px;
  padding: 4px max(var(--safe-right), 22px) 0 max(var(--safe-left), 22px);
}
.content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 4px 24px;
  scrollbar-width: thin;
}
.side {
  flex-shrink: 0;
  width: 92px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: none;
  padding-bottom: 12px;
}
.side::-webkit-scrollbar {
  display: none;
}
.feat {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px 6px;
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
  transition: transform 140ms var(--ease-out);
  animation: rise-in 420ms var(--ease-out) both;
}
.feat:hover {
  transform: translateY(-2px);
}
.feat:active {
  transform: scale(0.94);
}
.f-ico {
  width: 54px;
  height: 54px;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55));
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
  margin: 0 auto;
  width: min(880px, calc(100% - 40px));
  margin-bottom: calc(var(--safe-bottom) + 10px);
  animation: rise-in 420ms var(--ease-out) both;
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
@media (max-width: 1180px) {
  .brand {
    display: none;
  }
}
@media (max-width: 900px) {
  .body {
    flex-direction: column-reverse;
    gap: 8px;
  }
  .side {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px 0 6px;
  }
  .feat {
    flex-shrink: 0;
    width: 86px;
  }
  .f-ico {
    width: 42px;
    height: 42px;
  }
}
@media (orientation: landscape) and (max-height: 700px) {
  .topbar {
    padding-top: calc(var(--safe-top) + 6px);
    padding-bottom: 4px;
  }
  .tb-profile {
    --h: 52px;
  }
  .side {
    width: 76px;
  }
  .f-ico {
    width: 40px;
    height: 40px;
  }
  .f-label {
    font-size: 11px;
  }
  .navbar {
    width: min(760px, calc(100% - 40px));
    margin-bottom: calc(var(--safe-bottom) + 4px);
  }
  .content {
    padding-bottom: 8px;
  }
}
@media (max-width: 720px) {
  .topbar {
    gap: 8px;
  }
  .assets {
    gap: 6px;
  }
  .tb-gear {
    display: none;
  }
}
@media (max-width: 560px) {
  .topbar {
    flex-wrap: wrap;
    row-gap: 8px;
  }
  .tb-profile {
    --h: 56px;
  }
  .assets {
    width: 100%;
    justify-content: flex-end;
  }
  .assets :deep(.cb) {
    --h: 32px;
  }
}
</style>
