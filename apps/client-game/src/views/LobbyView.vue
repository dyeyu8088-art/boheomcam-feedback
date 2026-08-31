<template>
  <div class="lobby">
    <!-- 动态背景 -->
    <div class="bg">
      <div class="orb a" />
      <div class="orb b" />
    </div>

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="who" @click="tab = 'me'">
        <div class="avatar" :data-a="me?.avatarId ?? 1">{{ avatarEmoji(me?.avatarId ?? 1) }}</div>
        <div class="meta">
          <div class="nick">{{ me?.nickname ?? '—' }}</div>
          <div class="uid num">UID {{ me?.uid ?? '' }} <span class="vip" v-if="me?.vip">VIP{{ me?.vip }}</span></div>
        </div>
      </div>
      <div class="assets">
        <div class="pill num"><span class="ico gold">◉</span>{{ fmt(me?.coins) }}</div>
        <div class="pill num"><span class="ico dia">◆</span>{{ fmt(me?.diamonds) }}</div>
        <button class="gear" @click="showSettings = true">⚙</button>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="content">
      <keep-alive>
        <GameGrid v-if="tab === 'lobby'" @open-feature="openFeature" />
        <ActivityPanel v-else-if="tab === 'activity'" />
        <RecordsPanel v-else-if="tab === 'records'" />
        <FriendsPanel v-else-if="tab === 'friends'" />
        <MePanel v-else @logout="logout" />
      </keep-alive>
    </main>

    <!-- 底部导航 -->
    <nav class="bottomnav glass">
      <button v-for="item in navs" :key="item.key" :class="{ on: tab === item.key }" @click="tab = item.key">
        <span class="nico">{{ item.icon }}</span>
        <span class="nlabel">{{ t(item.label) }}</span>
        <span v-if="tab === item.key" class="dot" />
      </button>
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

    <!-- 功能弹窗（排行/邮件/公告） -->
    <FeatureModals ref="features" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import { t, setLocale, currentLocale } from '../i18n/index.js';
import ModalSheet from '../ui/ModalSheet.vue';
import GameGrid from './lobby/GameGrid.vue';
import ActivityPanel from './lobby/ActivityPanel.vue';
import RecordsPanel from './lobby/RecordsPanel.vue';
import FriendsPanel from './lobby/FriendsPanel.vue';
import MePanel from './lobby/MePanel.vue';
import FeatureModals from './lobby/FeatureModals.vue';
import { avatarEmoji, fmt } from '../ui/format.js';

const router = useRouter();
const user = useUserStore();
const me = computed(() => user.me);
const locale = currentLocale;
const tab = ref<'lobby' | 'activity' | 'records' | 'friends' | 'me'>('lobby');
const showSettings = ref(false);
const features = ref<InstanceType<typeof FeatureModals> | null>(null);

const navs = [
  { key: 'lobby' as const, icon: '🏛', label: 'nav.lobby' },
  { key: 'activity' as const, icon: '🎁', label: 'nav.activity' },
  { key: 'records' as const, icon: '📜', label: 'nav.records' },
  { key: 'friends' as const, icon: '👥', label: 'nav.friends' },
  { key: 'me' as const, icon: '👤', label: 'nav.me' },
];

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
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: radial-gradient(130% 100% at 50% 0%, #131a28 0%, var(--bg-abyss) 65%);
}
.bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.3;
}
.orb.a {
  width: 400px;
  height: 400px;
  background: #1a2a45;
  top: -140px;
  right: -80px;
  animation: float-slow 10s ease-in-out infinite;
}
.orb.b {
  width: 300px;
  height: 300px;
  background: rgba(201, 160, 99, 0.12);
  bottom: 10%;
  left: -100px;
  animation: float-slow 13s ease-in-out infinite reverse;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--safe-top) + 10px) max(var(--safe-right), 16px) 10px max(var(--safe-left), 16px);
  z-index: 2;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(160deg, #263040 0%, #1a2130 100%);
  border: 1px solid var(--line-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: var(--shadow-card);
}
.nick {
  font-weight: 700;
  font-size: 15px;
}
.uid {
  font-size: 11px;
  color: var(--text-secondary);
}
.vip {
  color: var(--gold-warm);
  font-weight: 700;
  margin-left: 4px;
}
.assets {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-charcoal);
  border: 1px solid var(--line-soft);
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
}
.ico.gold {
  color: var(--gold-warm);
}
.ico.dia {
  color: #7fb8e8;
}
.gear {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--bg-charcoal);
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
}
.content {
  flex: 1;
  overflow-y: auto;
  padding: 4px max(var(--safe-right), 16px) 90px max(var(--safe-left), 16px);
  z-index: 1;
}
.bottomnav {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--safe-bottom) + 10px);
  display: flex;
  gap: 2px;
  padding: 6px;
  border-radius: 22px;
  z-index: 3;
}
.bottomnav button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 6px 14px;
  cursor: pointer;
  border-radius: 16px;
  transition: color var(--dur-micro);
}
.bottomnav button.on {
  color: var(--gold-champagne);
}
.nico {
  font-size: 18px;
}
.nlabel {
  font-size: 11px;
}
.dot {
  position: absolute;
  bottom: 1px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--gold-warm);
  box-shadow: var(--shadow-glow-gold);
}
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
</style>
