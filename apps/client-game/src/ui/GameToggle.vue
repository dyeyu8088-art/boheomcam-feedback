<template>
  <button class="gt" :class="{ on: modelValue }" type="button" role="switch" :aria-checked="modelValue" :disabled="disabled" @click="toggle">
    <span v-if="label" class="gt-label">{{ label }}</span>
    <img class="gt-art" :src="modelValue ? onArt : offArt" alt="" draggable="false" />
    <span class="gt-state">{{ modelValue ? onText : offText }}</span>
  </button>
</template>

<script setup lang="ts">
import { asset } from '../assets/assets.js';
import { audio } from '../audio/AudioManager.js';

/** 开关：ON / OFF 两张素材切换，状态文字程序绘制（可传本地化文案） */
const props = withDefaults(defineProps<{ modelValue: boolean; label?: string; onText?: string; offText?: string; disabled?: boolean }>(), {
  onText: 'ON',
  offText: 'OFF',
  disabled: false,
});
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
const onArt = asset('common', 'toggleOn');
const offArt = asset('common', 'toggleOff');
function toggle(): void {
  audio.sfx('toggle');
  emit('update:modelValue', !props.modelValue);
}
</script>

<style scoped>
.gt {
  --h: 34px;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: var(--h);
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.gt:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.gt-label {
  font-size: 14px;
  font-weight: 700;
  color: #dfe4ec;
}
.gt-art {
  height: var(--h);
  width: auto;
  transition: transform 120ms var(--ease-out);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}
.gt:active .gt-art {
  transform: scale(0.94);
}
.gt-state {
  position: absolute;
  right: calc(var(--h) * 0.9);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}
.gt.on .gt-state {
  right: auto;
  left: calc(var(--h) * 0.45);
}
.gt-label + .gt-art ~ .gt-state {
  /* 有 label 时状态文字定位相对 art：用 transform 方式避免依赖 label 宽度 */
}
</style>
