<template>
  <Transition name="ls">
    <div v-if="visible" class="ls">
      <div class="ls-bg" />
      <img class="ls-mascot" :src="mascot" alt="" draggable="false" />
      <div class="ls-box">
        <div class="ls-title">{{ title }}</div>
        <ProgressBar :value="ratio" skin="chest" tone="gold" :text="`${Math.round(ratio * 100)}%`" class="ls-bar" />
        <div class="ls-hint">{{ hint }}</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ProgressBar from './ProgressBar.vue';
import { asset, preload, type AssetGroup } from '../assets/assets.js';
import { t } from '../i18n/index.js';

/**
 * 进入游戏前的资源预加载屏：真实按字节进度（assets.preload），不是假进度条。
 * 用法：`await loader.value.load(['common','fishing'], title)`；加载完自动淡出。
 */
const visible = ref(false);
const ratio = ref(0);
const title = ref('');
const hint = computed(() => (ratio.value >= 1 ? t('loading.ready') : t('loading.assets')));
const mascot = asset('fishing', 'bossCaishenFishRound');

async function load(groups: AssetGroup[], name: string): Promise<void> {
  title.value = name;
  ratio.value = 0;
  visible.value = true;
  const t0 = performance.now();
  await preload(groups, (p) => (ratio.value = p.bytesTotal ? p.bytesLoaded / p.bytesTotal : p.loaded / Math.max(1, p.total)));
  ratio.value = 1;
  // 至少展示 350ms，避免闪一下
  const wait = Math.max(0, 350 - (performance.now() - t0));
  await new Promise((r) => setTimeout(r, wait));
  visible.value = false;
}
defineExpose({ load });
</script>

<style scoped>
.ls {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  color: #fff;
}
.ls-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 30%, rgba(30, 70, 160, 0.6), transparent 60%),
    linear-gradient(180deg, #081a4a, #030a24);
}
.ls-mascot {
  position: relative;
  width: min(34vh, 220px);
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.6));
  animation: ls-bob 1.6s ease-in-out infinite;
}
.ls-box {
  position: relative;
  width: min(80vw, 420px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.ls-title {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: #ffe9a6;
  text-shadow: var(--sk-outline);
}
.ls-bar {
  --h: 30px;
  width: 100%;
}
.ls-hint {
  font-size: 13px;
  color: #9fb4e8;
}
.ls-enter-active,
.ls-leave-active {
  transition: opacity 260ms var(--ease-out);
}
.ls-enter-from,
.ls-leave-to {
  opacity: 0;
}
@keyframes ls-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
</style>
