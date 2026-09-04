<template>
  <div class="logo" :class="{ ko: locale === 'ko', [size]: true }" role="img" :aria-label="`${name} · ${brand.nameEn}`">
    <!-- 徽记：金色圆徽 + 长白山三峰（雪冠）+ 天池 + 海兰江水纹 + 朝阳。原创 SVG，无第三方素材 -->
    <svg class="emblem" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lgGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff3c8" />
          <stop offset="0.5" stop-color="#e9bf55" />
          <stop offset="1" stop-color="#8f6118" />
        </linearGradient>
        <radialGradient id="lgSky" cx="0.5" cy="0.3" r="0.75">
          <stop offset="0" stop-color="#1e4a9c" />
          <stop offset="1" stop-color="#071431" />
        </radialGradient>
        <linearGradient id="lgMtn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e0bb6a" />
          <stop offset="1" stop-color="#8a5c1a" />
        </linearGradient>
        <clipPath id="lgClip"><circle cx="32" cy="32" r="24.5" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" fill="url(#lgGold)" />
      <circle cx="32" cy="32" r="27.5" fill="#4a2f0a" />
      <circle cx="32" cy="32" r="25.5" fill="url(#lgGold)" />
      <circle cx="32" cy="32" r="24.5" fill="url(#lgSky)" />
      <g clip-path="url(#lgClip)">
        <circle cx="43" cy="21" r="4.6" fill="#ffe9a8" />
        <circle cx="43" cy="21" r="7.5" fill="#ffe9a8" opacity="0.18" />
        <path d="M4 44 L15 28 L21 35 L32 19 L41 32 L47 26 L60 44 Z" fill="url(#lgMtn)" />
        <path d="M28 25 L32 19 L36.5 25.5 L34 26.5 L32 23.8 L30 26.5 Z" fill="#fff5d6" />
        <path d="M12 33 L15 28 L18 32 L16.5 33 L15 31 L13.5 33 Z" fill="#fff5d6" opacity="0.8" />
        <ellipse cx="32" cy="36.5" rx="8" ry="2.4" fill="#8fdcff" opacity="0.95" />
        <ellipse cx="30" cy="36" rx="3" ry="0.8" fill="#ffffff" opacity="0.6" />
        <path d="M6 47 q6 -3.5 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#9fd8ff" stroke-width="1.7" stroke-linecap="round" />
        <path d="M4 52 q6 -3.5 12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#6fb7ea" stroke-width="1.5" stroke-linecap="round" opacity="0.85" />
        <path d="M8 57 q6 -3.5 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#4f93c9" stroke-width="1.3" stroke-linecap="round" opacity="0.7" />
      </g>
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#fff2c4" stroke-width="0.6" opacity="0.6" />
    </svg>
    <div class="text">
      <span class="name">{{ name }}</span>
      <span class="en">{{ brand.nameEn }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { currentLocale } from '../i18n/index.js';
import { useUserStore } from '../stores/user.js';

/** 平台 Logo：徽记 + HTML 文字（延边游戏 / 연변 게임 / YANBIAN GAME），文字随语言切换，不烙进图片 */
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });
const locale = currentLocale;
const user = useUserStore();
const brand = computed(() => user.brand);
const name = computed(() => (locale.value === 'ko' ? brand.value.nameKo : brand.value.nameZh));
</script>

<style scoped>
.logo {
  --h: 46px;
  display: inline-flex;
  align-items: center;
  gap: 11px;
  pointer-events: none;
  user-select: none;
}
.logo.sm {
  --h: 34px;
  gap: 8px;
}
.logo.lg {
  --h: 76px;
  gap: 16px;
}
.emblem {
  width: var(--h);
  height: var(--h);
  flex-shrink: 0;
  filter: drop-shadow(0 2px 10px rgba(245, 192, 74, 0.35));
}
.text {
  display: flex;
  flex-direction: column;
  gap: calc(var(--h) * 0.07);
}
.name {
  font-family: var(--font-display-zh);
  font-size: calc(var(--h) * 0.5);
  line-height: 1;
  letter-spacing: 0.3em;
  white-space: nowrap;
  background: linear-gradient(180deg, #fff6d5 0%, #ffd867 45%, #f39a1e 60%, #ffe28a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 #5a3305) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.6));
}
.logo.ko .name {
  font-family: var(--font-display-ko);
  font-weight: 800;
  font-size: calc(var(--h) * 0.42);
  letter-spacing: 0.1em;
}
.en {
  font-family: var(--font-brand);
  font-size: calc(var(--h) * 0.21);
  font-weight: 600;
  letter-spacing: 0.4em;
  color: #f5c04a;
  opacity: 0.85;
  white-space: nowrap;
}
</style>
