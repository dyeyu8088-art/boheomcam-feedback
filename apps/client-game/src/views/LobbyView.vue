<template>
  <div class="lobby">
    <!-- L1/L2 三层空间背景 -->
    <LobbyBackdrop />

    <!-- ══ 顶栏 ══ -->
    <header class="topbar">
      <!-- 玩家信息容器 -->
      <button class="player" @click="tab = 'me'">
        <AvatarBadge :id="me?.avatarId ?? 1" :size="56" :vip="(me?.vip ?? 0) > 0" />
        <span class="p-meta">
          <span class="p-name">{{ me?.nickname ?? '—' }}</span>
          <span class="p-line">
            <span class="p-uid num">UID {{ me?.uid ?? '' }}</span>
            <span class="p-lv">Lv.{{ me?.level ?? 1 }}</span>
            <span v-if="(me?.vip ?? 0) > 0" class="p-vip">VIP{{ me?.vip }}</span>
          </span>
        </span>
      </button>

      <!-- 品牌字标（YANBIAN ENTERTAINMENT） -->
      <div class="brand">
        <svg class="b-mark" viewBox="0 0 44 44">
          <defs>
            <linearGradient id="bmG" x1="0.15" y1="0" x2="0.85" y2="1">
              <stop offset="0" stop-color="#f6e6bd" />
              <stop offset="0.5" stop-color="#c9a063" />
              <stop offset="1" stop-color="#8a6b3c" />
            </linearGradient>
          </defs>
          <circle cx="22" cy="22" r="19.5" fill="none" stroke="url(#bmG)" stroke-width="1.4" opacity="0.85" />
          <circle cx="22" cy="22" r="15.5" fill="none" stroke="url(#bmG)" stroke-width="0.7" opacity="0.4" />
          <path d="M9 27 L16.5 17.5 L20.5 22.5 L25.5 15 L32 24 L35 20.5 L38 27" fill="none" stroke="url(#bmG)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="25.5" cy="10.5" r="3.2" fill="none" stroke="url(#bmG)" stroke-width="1.3" />
          <path d="M13 31 h18" stroke="url(#bmG)" stroke-width="1" stroke-linecap="round" opacity="0.6" />
        </svg>
        <div class="b-text">
          <span class="b-cn">{{ locale === 'ko' ? user.brand.nameKo : user.brand.nameZh }}</span>
          <span class="b-en">{{ user.brand.nameEn }}</span>
        </div>
      </div>

      <!-- 资产 + 设置 -->
      <div class="assets">
        <div class="cap">
          <AppIcon name="coin" :size="20" />
          <span class="cap-num num">{{ fmt(me?.coins) }}</span>
        </div>
        <div class="cap">
          <AppIcon name="gem" :size="19" />
          <span class="cap-num num">{{ fmt(me?.diamonds) }}</span>
        </div>
        <button class="gear" :title="t('settings.title')" @click="showSettings = true">
          <AppIcon name="gear" :size="19" />
        </button>
      </div>
    </header>

    <!-- ══ 内容区 ══ -->
    <main class="content">
      <keep-alive>
        <GameGrid v-if="tab === 'lobby'" @open-feature="openFeature" />
        <ActivityPanel v-else-if="tab === 'activity'" />
        <RecordsPanel v-else-if="tab === 'records'" />
        <FriendsPanel v-else-if="tab === 'friends'" />
        <MePanel v-else @logout="logout" />
      </keep-alive>
    </main>

    <!-- ══ 悬浮 Dock 导航 ══ -->
    <nav class="dock">
      <button v-for="item in navs" :key="item.key" class="dock-item" :class="{ on: tab === item.key }" @click="tab = item.key">
        <span class="d-plate"><AppIcon :name="item.icon" :size="22" /></span>
        <span class="d-label">{{ t(item.label) }}</span>
      </button>
      <span class="dock-glow" :style="{ transform: `translateX(${navIndex * 100}%)` }" />
    </nav>

    <!-- 设置 -->
    <ModalSheet v-model="showSettings" :title="t('settings.title')">
      <div class="set-row">
        <span>{{ t('settings.language') }}</span>
        <div class="seg">
          <button :class="{ on: locale === 'zh' }" @click="setLocale('zh')">中文</button>
          <button :class="{ on: locale === 'ko' }" @click="setLocale('ko')">한국어</button>
        </div>
      </div>
      <div class="set-row">
        <span>{{ t('settings.uid') }}</span>
        <span class="num dim">{{ me?.uid }}</span>
      </div>
      <button class="btn btn-danger" style="width: 100%; margin-top: 18px" @click="logout">
        {{ t('settings.logout') }}
      </button>
    </ModalSheet>

    <FeatureModals ref="features" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import { t, setLocale, currentLocale } from '../i18n/index.js';
import ModalSheet from '../ui/ModalSheet.vue';
import LobbyBackdrop from './lobby/LobbyBackdrop.vue';
import GameGrid from './lobby/GameGrid.vue';
import ActivityPanel from './lobby/ActivityPanel.vue';
import RecordsPanel from './lobby/RecordsPanel.vue';
import FriendsPanel from './lobby/FriendsPanel.vue';
import MePanel from './lobby/MePanel.vue';
import FeatureModals from './lobby/FeatureModals.vue';
import AppIcon from '../ui/AppIcon.vue';
import AvatarBadge from '../ui/AvatarBadge.vue';
import { fmt } from '../ui/format.js';

const router = useRouter();
const user = useUserStore();
const me = computed(() => user.me);
const locale = currentLocale;
const tab = ref<'lobby' | 'activity' | 'records' | 'friends' | 'me'>('lobby');
const showSettings = ref(false);
const features = ref<InstanceType<typeof FeatureModals> | null>(null);

const navs = [
  { key: 'lobby' as const, icon: 'hall', label: 'nav.lobby' },
  { key: 'activity' as const, icon: 'gift', label: 'nav.activity' },
  { key: 'records' as const, icon: 'scroll', label: 'nav.records' },
  { key: 'friends' as const, icon: 'friends', label: 'nav.friends' },
  { key: 'me' as const, icon: 'user', label: 'nav.me' },
];
const navIndex = computed(() => navs.findIndex((n) => n.key === tab.value));

onMounted(() => {
  if (!user.me) void user.loadMe();
  void user.loadBrand();
});

function openFeature(key: string): void {
  if (key === 'signin' || key === 'tasks') tab.value = 'activity';
  else features.value?.open(key);
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
  padding: calc(var(--safe-top) + 16px) max(var(--safe-right), 26px) 12px max(var(--safe-left), 26px);
  animation: fade-down 420ms var(--ease-out) both;
}
.player {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 18px 8px 10px;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(120deg, rgba(20, 30, 50, 0.66), rgba(12, 18, 31, 0.42));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 22px rgba(0, 0, 0, 0.4);
  transition:
    border-color 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}
.player:hover {
  border-color: rgba(201, 160, 99, 0.4);
  transform: translateY(-1px);
}
.player:active {
  transform: scale(0.98);
}
.p-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.p-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.02em;
  line-height: 1;
}
.p-line {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.p-uid {
  font-size: 11.5px;
  color: var(--text-disabled);
  white-space: nowrap;
}
.p-lv {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--accent-ice);
  border: 1px solid rgba(127, 184, 232, 0.35);
  border-radius: 5px;
  padding: 1.5px 5px;
}
.p-vip {
  font-size: 10.5px;
  font-weight: 800;
  color: #2a1e06;
  background: linear-gradient(180deg, #f6e6bd, #c9a063);
  border-radius: 5px;
  padding: 2px 6px;
  box-shadow: 0 2px 8px rgba(201, 160, 99, 0.35);
}
/* 品牌字标 */
.brand {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 11px;
  pointer-events: none;
  opacity: 0.96;
}
.b-mark {
  width: 40px;
  height: 40px;
  filter: drop-shadow(0 2px 10px rgba(201, 160, 99, 0.28));
}
.b-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.b-cn {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.32em;
  padding-left: 0.32em;
  background: linear-gradient(180deg, #f7ead0 10%, #d3ac6d 62%, #a07f43 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1;
}
.b-en {
  font-size: 8.5px;
  letter-spacing: 0.42em;
  padding-left: 0.42em;
  color: var(--text-disabled);
  line-height: 1;
}
@media (max-width: 1180px) {
  .brand {
    display: none;
  }
}

.assets {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cap {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 40px;
  padding: 0 16px 0 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(20, 30, 50, 0.72), rgba(11, 17, 29, 0.62));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.055);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    inset 0 -6px 12px rgba(0, 0, 0, 0.3),
    0 6px 16px rgba(0, 0, 0, 0.32);
}
.cap-num {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.gear {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  background: linear-gradient(180deg, rgba(20, 30, 50, 0.7), rgba(11, 17, 29, 0.6));
  border: 1px solid rgba(255, 255, 255, 0.055);
  box-shadow: var(--edge-inner);
  transition:
    color 180ms var(--ease-out),
    transform 260ms var(--ease-out),
    border-color 180ms var(--ease-out);
}
.gear:hover {
  color: var(--gold-champagne);
  border-color: rgba(201, 160, 99, 0.4);
  transform: rotate(38deg);
}

/* ══ 内容区 ══ */
.content {
  position: relative;
  z-index: 2;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px max(var(--safe-right), 26px) 132px max(var(--safe-left), 26px);
  /* 大屏时内容垂直居中，避免下半屏出现无意义空白 */
  display: flex;
  flex-direction: column;
  justify-content: center;
}
@media (max-height: 700px), (max-width: 720px) {
  .content {
    justify-content: flex-start;
  }
}

/* ══ Dock 导航 ══ */
.dock {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: calc(var(--safe-bottom) + 18px);
  transform: translateX(-50%);
  display: flex;
  align-items: stretch;
  width: min(620px, calc(100vw - 40px));
  height: 86px;
  padding: 8px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(18, 27, 45, 0.82), rgba(9, 14, 24, 0.86));
  backdrop-filter: blur(22px) saturate(1.15);
  -webkit-backdrop-filter: blur(22px) saturate(1.15);
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    0 18px 42px rgba(0, 0, 0, 0.55);
  animation: fade-up 460ms var(--ease-out) both;
}
.dock-glow {
  position: absolute;
  left: 8px;
  bottom: 10px;
  width: calc((100% - 16px) / 5);
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--gold-warm), transparent);
  box-shadow: 0 0 12px rgba(201, 160, 99, 0.7);
  transition: transform 320ms var(--ease-out);
  pointer-events: none;
}
.dock-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-disabled);
  border-radius: 20px;
  transition: color 180ms var(--ease-out);
}
.dock-item .d-plate {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  transition:
    transform 200ms var(--ease-out),
    background 200ms var(--ease-out),
    box-shadow 200ms var(--ease-out);
}
.dock-item:hover {
  color: var(--text-strong);
}
.dock-item:hover .d-plate {
  transform: translateY(-2px) scale(1.06);
}
.dock-item.on {
  color: var(--gold-champagne);
}
.dock-item.on .d-plate {
  background: radial-gradient(circle at 34% 26%, rgba(201, 160, 99, 0.28), rgba(10, 15, 26, 0.7) 78%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 6px 16px rgba(0, 0, 0, 0.45),
    0 0 18px rgba(201, 160, 99, 0.22);
}
.d-label {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* ══ 设置弹窗 ══ */
.set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(154, 163, 178, 0.1);
}
.seg {
  display: flex;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  overflow: hidden;
}
.seg button {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
}
.seg button.on {
  background: var(--gold-warm);
  color: #14100a;
  font-weight: 700;
}
.dim {
  color: var(--text-secondary);
}

@keyframes fade-down {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translate(-50%, 16px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* ══ 响应式：2K / 超宽屏（≥1921px）整体放大 ══ */
@media (min-width: 1921px) {
  .topbar {
    padding: calc(var(--safe-top) + 22px) max(var(--safe-right), 46px) 16px max(var(--safe-left), 46px);
  }
  .player {
    padding: 10px 24px 10px 12px;
    gap: 16px;
  }
  .player :deep(.ab) {
    width: 70px !important;
    height: 70px !important;
  }
  .p-name {
    font-size: 20px;
  }
  .p-uid {
    font-size: 14px;
  }
  .p-lv,
  .p-vip {
    font-size: 13px;
    padding: 2.5px 7px;
  }
  .b-mark {
    width: 52px;
    height: 52px;
  }
  .b-cn {
    font-size: 22px;
  }
  .b-en {
    font-size: 11px;
  }
  .assets {
    gap: 14px;
  }
  .cap {
    height: 52px;
    padding: 0 22px 0 16px;
    gap: 12px;
  }
  .cap-num {
    font-size: 19px;
  }
  .cap :deep(.appicon) {
    width: 26px;
    height: 26px;
  }
  .gear {
    width: 52px;
    height: 52px;
    border-radius: 17px;
  }
  .gear :deep(.appicon) {
    width: 25px;
    height: 25px;
  }
  .content {
    padding: 12px max(var(--safe-right), 46px) 166px max(var(--safe-left), 46px);
  }
  .dock {
    width: min(780px, calc(100vw - 60px));
    height: 108px;
    bottom: calc(var(--safe-bottom) + 26px);
    padding: 10px;
    border-radius: 32px;
  }
  .dock-item .d-plate {
    width: 52px;
    height: 52px;
    border-radius: 17px;
  }
  .dock-item :deep(.appicon) {
    width: 29px;
    height: 29px;
  }
  .d-label {
    font-size: 14.5px;
  }
  .dock-glow {
    height: 4px;
    bottom: 13px;
  }
}

/* ══ 响应式：横屏短屏（Android 横屏 / 16:9 手机横屏） ══ */
@media (orientation: landscape) and (max-height: 700px) {
  .topbar {
    gap: 10px;
    padding: calc(var(--safe-top) + 8px) max(var(--safe-right), 16px) 6px max(var(--safe-left), 16px);
  }
  .player {
    padding: 5px 14px 5px 5px;
    gap: 9px;
  }
  .player :deep(.ab) {
    width: 40px !important;
    height: 40px !important;
  }
  .p-name {
    font-size: 14px;
  }
  .p-uid {
    font-size: 10px;
  }
  .p-lv,
  .p-vip {
    font-size: 9.5px;
    padding: 1px 4px;
  }
  .assets {
    gap: 8px;
  }
  .cap {
    height: 34px;
    padding: 0 13px 0 9px;
    gap: 7px;
  }
  .cap-num {
    font-size: 13px;
  }
  .cap :deep(.appicon) {
    width: 17px;
    height: 17px;
  }
  .gear {
    width: 34px;
    height: 34px;
    border-radius: 11px;
  }
  .content {
    padding: 4px max(var(--safe-right), 16px) 82px max(var(--safe-left), 16px);
  }
  .dock {
    width: min(520px, calc(100vw - 32px));
    height: 60px;
    bottom: calc(var(--safe-bottom) + 10px);
    padding: 6px;
    border-radius: 20px;
  }
  .dock-item {
    gap: 1px;
  }
  .dock-item .d-plate {
    width: 26px;
    height: 26px;
    border-radius: 9px;
  }
  .dock-item :deep(.appicon) {
    width: 18px;
    height: 18px;
  }
  .d-label {
    font-size: 10px;
  }
  .dock-glow {
    bottom: 6px;
  }
}

/* ══ 响应式：手机竖屏收敛 ══ */
@media (max-width: 720px) {
  .topbar {
    padding-left: max(var(--safe-left), 14px);
    padding-right: max(var(--safe-right), 14px);
  }
  .content {
    padding-left: max(var(--safe-left), 14px);
    padding-right: max(var(--safe-right), 14px);
    padding-bottom: 118px;
  }
  .topbar {
    gap: 8px;
    padding-top: calc(var(--safe-top) + 10px);
  }
  .player {
    padding: 6px 12px 6px 6px;
    gap: 9px;
    min-width: 0;
  }
  .p-name {
    font-size: 13.5px;
    max-width: 88px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .p-uid {
    font-size: 10px;
  }
  .p-lv {
    font-size: 9.5px;
    padding: 1px 4px;
  }
  .assets {
    gap: 6px;
  }
  .cap {
    height: 34px;
    padding: 0 12px 0 9px;
  }
  .cap-num {
    font-size: 13px;
  }
  .gear {
    width: 34px;
    height: 34px;
  }
  .dock {
    height: 74px;
    border-radius: 22px;
  }
  .dock-item .d-plate {
    width: 34px;
    height: 34px;
  }
  .d-label {
    font-size: 10.5px;
  }
}
</style>
