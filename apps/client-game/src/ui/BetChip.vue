<template>
  <button class="chip" :class="[size, { on: selected, disabled }]" :disabled="disabled" type="button" :title="String(value)" @click="pick">
    <img :src="src" alt="" draggable="false" decoding="async" />
    <span v-if="!known" class="chip-val num">{{ short }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { asset } from '../assets/assets.js';
import { audio } from '../audio/AudioManager.js';

/** 筹码：面额与素材一一对应（素材上的面额文字是静态版面）；非标准面额退回金框 + 程序文字 */
const props = withDefaults(defineProps<{ value: number; selected?: boolean; size?: 'sm' | 'md' | 'lg'; disabled?: boolean }>(), {
  selected: false,
  size: 'md',
  disabled: false,
});
const emit = defineEmits<{ (e: 'select', value: number): void }>();
const CHIPS: Record<number, string> = {
  10: asset('roulette', 'rouletteChip10'),
  50: asset('roulette', 'rouletteChip50'),
  100: asset('roulette', 'rouletteChip100'),
  500: asset('roulette', 'rouletteChip500'),
  1000: asset('roulette', 'rouletteChip1k'),
  5000: asset('roulette', 'rouletteChip5k'),
  10000: asset('roulette', 'rouletteChip10k'),
  50000: asset('roulette', 'rouletteChip50k'),
  100000: asset('roulette', 'rouletteChip100k'),
  500000: asset('roulette', 'rouletteChip500k'),
  1000000: asset('roulette', 'rouletteChip1m'),
};
const known = computed(() => props.value in CHIPS);
const src = computed(() => CHIPS[props.value] ?? asset('roulette', 'rouletteChip1k'));
const short = computed(() => (props.value >= 1000000 ? `${props.value / 1000000}M` : props.value >= 1000 ? `${props.value / 1000}K` : String(props.value)));
function pick(): void {
  audio.sfx('chip');
  emit('select', props.value);
}
</script>

<style scoped>
.chip {
  --d: 64px;
  position: relative;
  width: var(--d);
  height: var(--d);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform 140ms var(--ease-out),
    filter 140ms var(--ease-out);
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
}
.chip.sm {
  --d: 46px;
}
.chip.lg {
  --d: 84px;
}
/* 素材自带 16% 透明安全边距：图片盒按 1/0.68 放大并负偏移，可见板件与按钮盒等大（docs/12） */
.chip img {
  position: absolute;
  inset: -23.5%;
  width: 147%;
  height: 147%;
  object-fit: contain;
  object-position: center;
  pointer-events: none;
}
.chip:hover:not(:disabled) {
  transform: translateY(-3px);
}
.chip:active:not(:disabled) {
  transform: scale(0.92);
}
.chip.on {
  transform: translateY(-8px) scale(1.1);
  filter: drop-shadow(0 0 12px rgba(255, 226, 138, 0.9)) drop-shadow(0 6px 8px rgba(0, 0, 0, 0.5));
}
.chip:disabled {
  filter: grayscale(0.7) brightness(0.55);
  cursor: not-allowed;
}
.chip-val {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: calc(var(--d) * 0.28);
  color: #fff;
  text-shadow: var(--sk-outline);
}
</style>
