<template>
  <div class="bs" :class="[skin, { inline: !!plateInline }]">
    <template v-if="plateInline">
      <!-- 板件自带 ± 的素材：透明热区覆盖在两端 -->
      <img class="bs-plate" :src="plateInline" alt="" draggable="false" />
      <button class="bs-hit l" :class="{ pressed: pressedL }" :disabled="!canDec" type="button" aria-label="-" @pointerdown="pressedL = true" @pointerup="pressedL = false" @pointerleave="pressedL = false" @click="step(-1)" />
      <button class="bs-hit r" :class="{ pressed: pressedR }" :disabled="!canInc" type="button" aria-label="+" @pointerdown="pressedR = true" @pointerup="pressedR = false" @pointerleave="pressedR = false" @click="step(1)" />
    </template>
    <template v-else>
      <GameButton round size="sm" :art="minusArt" :disabled="!canDec" sfx="tick" @click="step(-1)" />
      <span class="bs-mid">
        <img v-if="plateArt" class="bs-plate" :src="plateArt" alt="" draggable="false" />
        <span v-else class="bs-css" />
      </span>
      <GameButton round size="sm" :art="plusArt" :disabled="!canInc" sfx="tick" @click="step(1)" />
    </template>
    <span class="bs-val num">{{ format ? format(modelValue) : modelValue.toLocaleString('en-US') }}</span>
    <span v-if="label" class="bs-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import GameButton from './GameButton.vue';
import { asset } from '../assets/assets.js';
import { audio } from '../audio/AudioManager.js';

/**
 * 投注 / 倍率步进器。`options` 给离散档位（炮倍 / 投注档），否则 min/max/step。
 * 皮肤：fishingBlue/Green/Purple、slot（板件自带 ±，热区覆盖）；gold/mahjong/red10（独立 ± 圆钮）。
 * 数字永远由程序绘制。
 */
const props = withDefaults(
  defineProps<{
    modelValue: number;
    options?: number[];
    min?: number;
    max?: number;
    step?: number;
    skin?: 'fishingBlue' | 'fishingGreen' | 'fishingPurple' | 'slot' | 'gold' | 'mahjong' | 'red10';
    label?: string;
    format?: (v: number) => string;
    disabled?: boolean;
  }>(),
  { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, skin: 'gold', disabled: false },
);
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void; (e: 'change', v: number): void }>();
const pressedL = ref(false);
const pressedR = ref(false);

const plateInline = computed(() => {
  switch (props.skin) {
    case 'fishingBlue':
      return asset('fishing', 'betPlateBlue');
    case 'fishingGreen':
      return asset('fishing', 'betPlateGreen');
    case 'fishingPurple':
      return asset('fishing', 'betPlatePurple');
    case 'slot':
      return asset('slots', 'totalBetPlate');
    default:
      return '';
  }
});
const plateArt = computed(() => (props.skin === 'mahjong' ? asset('mahjong', 'betPlate') : props.skin === 'red10' ? asset('red10', 'betPlate') : ''));
const minusArt = computed(() => (props.skin === 'mahjong' ? asset('mahjong', 'btnMinusOrange') : props.skin === 'red10' ? asset('red10', 'btnMinusGold') : asset('fishing', 'btnBetMinus')));
const plusArt = computed(() => (props.skin === 'mahjong' ? asset('mahjong', 'btnPlusOrange') : props.skin === 'red10' ? asset('red10', 'btnPlusGold') : asset('fishing', 'btnBetPlus')));

const idx = computed(() => (props.options ? props.options.indexOf(props.modelValue) : -1));
const canDec = computed(() => !props.disabled && (props.options ? idx.value > 0 : props.modelValue - props.step >= props.min));
const canInc = computed(() => !props.disabled && (props.options ? idx.value < props.options.length - 1 : props.modelValue + props.step <= props.max));
function step(d: 1 | -1): void {
  if (d < 0 && !canDec.value) return;
  if (d > 0 && !canInc.value) return;
  audio.sfx('tick');
  const next = props.options ? props.options[idx.value + d]! : props.modelValue + d * props.step;
  emit('update:modelValue', next);
  emit('change', next);
}
</script>

<style scoped>
.bs {
  --h: 44px;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--h);
  min-width: calc(var(--h) * 4.6);
}
.bs.inline {
  min-width: calc(var(--h) * 5.2);
}
.bs-plate {
  height: 100%;
  width: 100%;
  object-fit: fill;
  pointer-events: none;
}
.bs.inline .bs-plate {
  position: absolute;
  inset: 0;
}
.bs-mid {
  position: relative;
  flex: 1;
  height: calc(var(--h) * 0.86);
  display: flex;
}
.bs-css {
  flex: 1;
  border-radius: calc(var(--h) * 0.4);
  background: linear-gradient(180deg, #0c1a45, #071033);
  box-shadow:
    inset 0 0 0 2px #7d4d0c,
    inset 0 0 0 3.5px #f0c14e,
    inset 0 4px 10px rgba(0, 0, 0, 0.6);
}
.bs-hit {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 22%;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition: transform 100ms var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}
.bs-hit.l {
  left: -2%;
}
.bs-hit.r {
  right: -2%;
}
.bs-hit.pressed:not(:disabled) {
  transform: scale(0.85);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.25), transparent 70%);
}
.bs-hit:disabled {
  cursor: not-allowed;
}
.bs-val {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  font-size: calc(var(--h) * 0.44);
  font-weight: 900;
  color: #ffe9a6;
  text-shadow:
    0 1px 0 #3a2200,
    0 2px 5px rgba(0, 0, 0, 0.7);
  pointer-events: none;
  white-space: nowrap;
}
.bs.slot .bs-val {
  top: 58%;
  font-size: calc(var(--h) * 0.4);
}
.bs-label {
  position: absolute;
  left: 50%;
  top: -14px;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 700;
  color: #9fb4e8;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
</style>
