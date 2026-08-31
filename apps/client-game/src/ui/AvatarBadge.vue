<template>
  <!--
    原创头像纹章系统（零 Emoji）：深色金属底板 + 抽象东方纹章。
    纹章族群由 id 派生，稳定可复现；VIP 时启用金环呼吸光。
  -->
  <div class="ab" :style="wrapStyle" :class="{ vip }">
    <svg :viewBox="`0 0 64 64`" class="ab-svg">
      <defs>
        <linearGradient :id="gid('p')" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" :stop-color="pal[0]" />
          <stop offset="1" :stop-color="pal[1]" />
        </linearGradient>
        <linearGradient :id="gid('m')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="pal[2]" />
          <stop offset="1" :stop-color="pal[3]" />
        </linearGradient>
        <radialGradient :id="gid('s')" cx="0.3" cy="0.2" r="0.75">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.16" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" :rx="radius" :fill="`url(#${gid('p')})`" />
      <g :fill="`url(#${gid('m')})`" :stroke="`url(#${gid('m')})`" stroke-width="0" transform="translate(8 8) scale(0.75)">
        <!-- 0 长白山双峰 -->
        <template v-if="crest === 0">
          <path d="M4 52 L20 24 L30 38 L40 18 L60 52 z" />
          <circle cx="40" cy="12" r="5" opacity="0.85" />
        </template>
        <!-- 1 松枝 -->
        <template v-else-if="crest === 1">
          <path d="M32 6 L44 28 L36 28 L46 44 L36 44 L44 56 L20 56 L28 44 L18 44 L28 28 L20 28 z" />
        </template>
        <!-- 2 雪晶 -->
        <template v-else-if="crest === 2">
          <path d="M32 6 v52 M10 19 l44 26 M54 19 l-44 26" stroke-width="6" stroke-linecap="round" fill="none" />
          <circle cx="32" cy="32" r="7" />
        </template>
        <!-- 3 云纹 -->
        <template v-else-if="crest === 3">
          <path d="M10 42 q0 -12 12 -12 q2 -12 14 -12 q14 0 16 14 q10 2 10 10 q0 8 -10 8 H20 q-10 0 -10 -8 z" />
          <path d="M18 52 h30" stroke-width="4" stroke-linecap="round" />
        </template>
        <!-- 4 鹤形 -->
        <template v-else-if="crest === 4">
          <path d="M18 52 q6 -20 20 -24 q10 -3 14 -12 q4 10 -4 18 q-10 10 -14 18 z" />
          <circle cx="50" cy="14" r="4" />
          <path d="M14 54 h34" stroke-width="4" stroke-linecap="round" />
        </template>
        <!-- 5 波涛 -->
        <template v-else-if="crest === 5">
          <path d="M6 40 q10 -14 20 0 t20 0 t12 -4 v18 H6 z" />
          <path d="M10 26 q10 -12 20 0 t20 0" stroke-width="4" fill="none" stroke-linecap="round" />
        </template>
        <!-- 6 虎纹 -->
        <template v-else-if="crest === 6">
          <path d="M12 12 q14 6 12 20 q-2 12 -12 18 q10 -18 0 -38 z" />
          <path d="M32 8 q12 10 10 26 q-2 14 -10 22 q8 -20 0 -48 z" />
          <path d="M52 14 q10 8 8 22 q-2 10 -8 16 q6 -18 0 -38 z" />
        </template>
        <!-- 7 六角窗棂 -->
        <template v-else-if="crest === 7">
          <path d="M32 4 L56 18 V46 L32 60 L8 46 V18 z" fill="none" stroke-width="5" />
          <path d="M32 18 L44 25 V39 L32 46 L20 39 V25 z" />
        </template>
        <!-- 8 火焰 -->
        <template v-else-if="crest === 8">
          <path d="M32 4 q8 16 4 22 q6 -2 8 -8 q10 12 6 24 q-4 14 -18 14 q-14 0 -18 -14 q-3 -12 6 -22 q2 8 8 8 q-4 -10 4 -24 z" />
        </template>
        <!-- 9 太极环 -->
        <template v-else-if="crest === 9">
          <circle cx="32" cy="32" r="26" fill="none" stroke-width="5" />
          <path d="M32 6 a13 13 0 0 1 0 26 a13 13 0 0 0 0 26 a26 26 0 0 1 0 -52 z" />
        </template>
        <!-- 10 印章方 -->
        <template v-else-if="crest === 10">
          <rect x="8" y="8" width="48" height="48" rx="6" fill="none" stroke-width="6" />
          <rect x="22" y="22" width="20" height="20" rx="3" />
        </template>
        <!-- 11 竹节 -->
        <template v-else>
          <rect x="26" y="4" width="12" height="16" rx="4" />
          <rect x="26" y="24" width="12" height="16" rx="4" />
          <rect x="26" y="44" width="12" height="16" rx="4" />
          <path d="M38 16 q14 2 18 -6 M38 38 q14 2 18 -6 M26 28 q-14 2 -18 -6" stroke-width="4" fill="none" stroke-linecap="round" />
        </template>
      </g>
      <rect x="0" y="0" width="64" height="64" :rx="radius" :fill="`url(#${gid('s')})`" />
    </svg>
    <span v-if="ring" class="ab-ring" :style="{ borderRadius: `${radius * (size / 64)}px` }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ id: number; size?: number; ring?: boolean; vip?: boolean }>(), {
  size: 44,
  ring: true,
  vip: false,
});

/** 底板配色 × 纹章配色（低饱和、与品牌金/玉青同族） */
const PALETTES: [string, string, string, string][] = [
  ['#233047', '#141c2b', '#c9a063', '#8a6b3c'],
  ['#1f3a37', '#122421', '#63c2a8', '#2f6f5e'],
  ['#2e2740', '#181428', '#b9a2e0', '#6b5698'],
  ['#3a2c2c', '#1f1616', '#e0a98a', '#96604a'],
  ['#22314a', '#131b2c', '#8fc4f0', '#456a94'],
  ['#2c3320', '#171c10', '#c2d18a', '#6f7d46'],
  ['#3a2f22', '#1e1810', '#e8cf9a', '#96763c'],
  ['#252a3d', '#141726', '#a8b4d4', '#5a6486'],
];

const pal = computed(() => PALETTES[props.id % PALETTES.length]!);
const crest = computed(() => props.id % 12);
const radius = 20;
const uid = `av${Math.random().toString(36).slice(2, 7)}`;
const gid = (k: string): string => `${uid}${k}${props.id}`;

const wrapStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${Math.round(radius * (props.size / 64))}px`,
}));
</script>

<style scoped>
.ab {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -8px 14px rgba(0, 0, 0, 0.35),
    0 6px 16px rgba(0, 0, 0, 0.5);
}
.ab-svg {
  width: 100%;
  height: 100%;
  display: block;
}
.ab-ring {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(201, 160, 99, 0.55);
  pointer-events: none;
}
.ab.vip .ab-ring {
  border-color: rgba(230, 207, 163, 0.9);
  box-shadow:
    0 0 0 1px rgba(201, 160, 99, 0.3),
    0 0 14px rgba(201, 160, 99, 0.45);
  animation: ab-breathe 3.2s ease-in-out infinite;
}
@keyframes ab-breathe {
  0%,
  100% {
    opacity: 0.75;
  }
  50% {
    opacity: 1;
  }
}
</style>
