<template>
  <div class="jb" :class="[tier, size, { hit }]">
    <img class="jb-frame" :src="frame" alt="" draggable="false" decoding="async" />
    <span v-if="label" class="jb-label">{{ label }}</span>
    <AnimatedNumber class="jb-num" :value="amount" raw :duration="900" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AnimatedNumber from './AnimatedNumber.vue';
import { asset } from '../assets/assets.js';

/**
 * Jackpot 条：四档奖池外框为素材（金额已抹），金额由服务器推送后滚动显示。
 * `hit` 播放命中闪光。tier `custom` 用轮盘 / 麻将的通用横幅。
 */
const props = withDefaults(
  defineProps<{ tier: 'grand' | 'major' | 'minor' | 'mini' | 'roulette' | 'red10' | 'mahjong'; amount: number; size?: 'sm' | 'md' | 'lg'; hit?: boolean; label?: string }>(),
  { size: 'md', hit: false },
);
const frame = computed(() => {
  switch (props.tier) {
    case 'grand':
      return asset('slots', 'jackpotGrand');
    case 'major':
      return asset('slots', 'jackpotMajor');
    case 'minor':
      return asset('slots', 'jackpotMinor');
    case 'mini':
      return asset('slots', 'jackpotMini');
    case 'roulette':
      return asset('roulette', 'jackpotBanner');
    case 'red10':
      return asset('red10', 'jackpotBanner');
    default:
      return asset('mahjong', 'jackpotBanner');
  }
});
</script>

<style scoped>
.jb {
  --w: 300px;
  position: relative;
  width: var(--w);
  aspect-ratio: 3.4 / 1;
  flex-shrink: 0;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
}
.jb.sm {
  --w: 200px;
}
.jb.lg {
  --w: 420px;
}
.jb.roulette,
.jb.red10,
.jb.mahjong {
  aspect-ratio: 2 / 1;
}
.jb.mahjong {
  aspect-ratio: 2.55 / 1;
}
.jb-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.jb-num {
  position: absolute;
  left: 50%;
  top: 68%;
  transform: translate(-50%, -50%);
  font-size: calc(var(--w) * 0.085);
  font-weight: 900;
  color: #fff3c4;
  text-shadow:
    0 1px 0 #5a3305,
    0 0 8px rgba(255, 200, 80, 0.55),
    0 2px 6px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.jb.roulette .jb-num,
.jb.red10 .jb-num {
  top: 84%;
  font-size: calc(var(--w) * 0.075);
}
.jb.mahjong .jb-num {
  top: 82%;
}
.jb-label {
  position: absolute;
  left: 50%;
  top: 30%;
  transform: translate(-50%, -50%);
  font-size: calc(var(--w) * 0.05);
  font-weight: 800;
  color: #ffe9a6;
  letter-spacing: 0.2em;
  text-shadow: var(--sk-outline);
}
.jb.hit {
  animation: jb-hit 700ms var(--ease-out) 3;
}
@keyframes jb-hit {
  0%,
  100% {
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
  }
  50% {
    filter: drop-shadow(0 0 18px rgba(255, 226, 138, 1)) brightness(1.3);
  }
}
</style>
