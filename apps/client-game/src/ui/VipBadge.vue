<template>
  <div class="vip" :class="size" :title="`VIP ${level}`">
    <img class="vip-art" :src="art" alt="" draggable="false" />
    <span class="vip-lv num">{{ level }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { asset } from '../assets/assets.js';

/** VIP 徽章：翼形金徽为素材（数字已抹），等级由程序绘制在下方小牌上 */
const props = withDefaults(defineProps<{ level: number; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });
const art = computed(() => asset('common', 'vipBadgeWings'));
const level = computed(() => Math.max(0, Math.floor(props.level)));
</script>

<style scoped>
.vip {
  --h: 44px;
  position: relative;
  width: calc(var(--h) * 1.18);
  height: var(--h);
  flex-shrink: 0;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
}
.vip.sm {
  --h: 30px;
}
.vip.lg {
  --h: 72px;
}
.vip-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.vip-lv {
  position: absolute;
  left: 50%;
  top: 74%;
  transform: translate(-50%, -50%);
  font-size: calc(var(--h) * 0.3);
  font-weight: 900;
  color: #fff;
  text-shadow:
    0 1px 0 #1a2e6e,
    0 0 4px rgba(0, 0, 0, 0.7);
  line-height: 1;
}
</style>
