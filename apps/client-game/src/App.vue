<template>
  <div class="app-root">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <!-- 全局 Toast -->
    <div class="toast-wrap">
      <transition-group name="toast">
        <div v-for="item in toasts" :key="item.id" class="toast glass" :class="item.kind">
          <span class="bar" />{{ item.text }}
        </div>
      </transition-group>
    </div>

    <!-- 网络状态 -->
    <div v-if="netStatus === 'reconnecting'" class="net-banner">{{ t('net.reconnecting') }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { toasts } from './ui/toast.js';
import { t } from './i18n/index.js';
import { gameSocket } from './net/ws.js';

const netStatus = ref(gameSocket.status);
gameSocket.onStatus = (s) => {
  netStatus.value = s;
};
</script>

<style scoped>
.app-root {
  height: 100%;
}
.toast-wrap {
  position: fixed;
  top: calc(var(--safe-top) + 14px);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 999;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  font-size: 14px;
  max-width: 80vw;
}
.toast .bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--gold-warm);
}
.toast.success .bar {
  background: var(--accent-jade);
}
.toast.error .bar {
  background: var(--accent-crimson);
}
.toast-enter-active,
.toast-leave-active {
  transition: all var(--dur-panel) var(--ease-out);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-16px);
}
.toast-leave-to {
  opacity: 0;
}
.net-banner {
  position: fixed;
  bottom: calc(var(--safe-bottom) + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--glass);
  border: 1px solid var(--line-soft);
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 13px;
  color: var(--gold-champagne);
  z-index: 998;
}
</style>
