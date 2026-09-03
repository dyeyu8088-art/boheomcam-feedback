<template>
  <div class="pb" :class="skin">
    <span class="pb-track" :style="trackStyle">
      <i class="pb-fill" :class="tone" :style="{ width: `${pct}%` }" />
      <i v-if="pct > 4" class="pb-gloss" :style="{ width: `${pct}%` }" />
    </span>
    <img v-if="frame" class="pb-frame" :src="frame" alt="" draggable="false" />
    <span v-if="text !== undefined" class="pb-text num">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { asset } from '../assets/assets.js';

/**
 * 进度条：素材只提供外框（龙头 / 宝箱），轨道与填充程序绘制并按皮肤对齐到外框内槽。
 * `value` 0..1；`tone` 决定填充色（金 / 红 HP / 蓝经验 / 绿）。
 */
const props = withDefaults(
  defineProps<{ value: number; skin?: 'dragon' | 'chest' | 'plain'; tone?: 'gold' | 'red' | 'blue' | 'green'; text?: string | number }>(),
  { skin: 'plain', tone: 'gold' },
);
const pct = computed(() => Math.max(0, Math.min(1, props.value)) * 100);
const frame = computed(() => (props.skin === 'dragon' ? asset('common', 'progressBarDragon') : props.skin === 'chest' ? asset('common', 'progressBarChest') : ''));
/** 各皮肤外框内槽的位置（相对外框的百分比） */
const INSET: Record<string, { l: number; r: number; t: number; b: number }> = {
  dragon: { l: 13, r: 4, t: 30, b: 30 },
  chest: { l: 2.5, r: 22, t: 30, b: 30 },
  plain: { l: 0, r: 0, t: 0, b: 0 },
};
const trackStyle = computed(() => {
  const i = INSET[props.skin]!;
  return { left: `${i.l}%`, right: `${i.r}%`, top: `${i.t}%`, bottom: `${i.b}%` };
});
</script>

<style scoped>
.pb {
  --h: 22px;
  position: relative;
  height: var(--h);
  width: 100%;
  min-width: 120px;
}
.pb.plain {
  border-radius: calc(var(--h) / 2);
  background: #0a1330;
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 2.5px #f0c14e,
    inset 0 3px 6px rgba(0, 0, 0, 0.6);
}
.pb-track {
  position: absolute;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(3, 8, 24, 0.85);
}
.pb.plain .pb-track {
  inset: 3px;
}
.pb-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  transition: width 420ms var(--ease-out);
}
.pb-fill.gold {
  background: linear-gradient(180deg, #ffe9a6, #f8c74a 50%, #e08a12);
}
.pb-fill.red {
  background: linear-gradient(180deg, #ff8a7a, #e0261f 50%, #8f0a0a);
}
.pb-fill.blue {
  background: linear-gradient(180deg, #8ac8ff, #2f7be6 50%, #143f9e);
}
.pb-fill.green {
  background: linear-gradient(180deg, #b6ff9a, #3fbf3a 50%, #1f8a2b);
}
.pb-gloss {
  position: absolute;
  left: 0;
  top: 0;
  height: 45%;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0));
  transition: width 420ms var(--ease-out);
}
.pb-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}
.pb-text {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: calc(var(--h) * 0.6);
  font-weight: 800;
  color: #fff;
  text-shadow: var(--sk-outline);
  white-space: nowrap;
}
</style>
