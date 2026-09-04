<template>
  <button
    class="gb"
    :class="[`v-${variant}`, `s-${size}`, { round, art: !!art, pressed, loading, block }]"
    :disabled="disabled || loading"
    type="button"
    @pointerdown="press"
    @pointerup="release"
    @pointercancel="release"
    @pointerleave="release"
    @click="onClick"
  >
    <!-- 成品位图按钮（素材表里烙有文案的按钮；由调用方按语言决定是否传入） -->
    <img v-if="art" class="gb-art" :src="art" alt="" draggable="false" decoding="async" />
    <!-- CSS 板件：金框 + 上亮下暗 + 内高光 -->
    <span v-else class="gb-plate" />
    <span class="gb-content" :class="{ hidden: !!art && !forceLabel }">
      <img v-if="icon" class="gb-icon" :src="icon" alt="" draggable="false" />
      <span v-if="$slots.default" class="gb-label"><slot /></span>
    </span>
    <span v-if="badge !== undefined && badge !== null && badge !== 0" class="gb-badge num">{{ badge }}</span>
    <span v-if="loading" class="gb-spin" />
    <span class="gb-shine" />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { audio } from '../audio/AudioManager.js';

/**
 * 统一游戏按钮（用户要求 §十四 / §十九）
 * - 四态：normal / hover / pressed / disabled，全部有可见反馈 + 点击音效
 * - `art`：直接使用素材表成品按钮；`icon`：素材图标 + 程序文字（双语）
 * - `variant`：CSS 板件配色，与素材表同色系
 */
const props = withDefaults(
  defineProps<{
    variant?: 'gold' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'dark' | 'ghost';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    art?: string;
    icon?: string;
    round?: boolean;
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    badge?: number | string | null;
    forceLabel?: boolean;
    sfx?: string | false;
  }>(),
  { variant: 'gold', size: 'md', round: false, disabled: false, loading: false, block: false, forceLabel: false, sfx: 'click' },
);
const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
const pressed = ref(false);
function press(): void {
  pressed.value = true;
}
function release(): void {
  pressed.value = false;
}
function onClick(ev: MouseEvent): void {
  const el = ev.currentTarget as HTMLButtonElement | null;
  if (el?.disabled) return;
  if (props.sfx) audio.sfx(props.sfx);
  emit('click', ev);
}
</script>

<style scoped>
.gb {
  --h: 46px;
  --px: 22px;
  --fs: 16px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--h);
  min-width: var(--h);
  padding: 0 var(--px);
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #fff;
  font: inherit;
  font-weight: 800;
  font-size: var(--fs);
  letter-spacing: 0.04em;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transition:
    transform 110ms var(--ease-out),
    filter 110ms var(--ease-out);
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
}
.gb.block {
  display: flex;
  width: 100%;
}
.gb.s-xs {
  --h: 30px;
  --px: 12px;
  --fs: 12px;
}
.gb.s-sm {
  --h: 38px;
  --px: 16px;
  --fs: 14px;
}
.gb.s-lg {
  --h: 58px;
  --px: 30px;
  --fs: 20px;
}
.gb.s-xl {
  --h: 72px;
  --px: 40px;
  --fs: 26px;
}
.gb.round {
  padding: 0;
  width: var(--h);
  border-radius: 50%;
}
.gb:hover:not(:disabled) {
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5)) brightness(1.08);
  transform: translateY(-1px);
}
.gb.pressed:not(:disabled),
.gb:active:not(:disabled) {
  transform: translateY(1px) scale(0.95);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) brightness(0.92);
}
.gb:disabled {
  cursor: not-allowed;
  filter: grayscale(0.7) brightness(0.6) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}
/* 位图成品 */
/* 素材自带 16% 透明安全边距：图片盒按 1/0.68 放大并负偏移，可见板件与按钮盒等大（docs/12） */
.gb-art {
  position: absolute;
  inset: -23.5%;
  width: 147%;
  height: 147%;
  object-fit: contain;
  object-position: center;
  pointer-events: none;
}
.gb.art {
  padding: 0;
  min-width: calc(var(--h) * 2.6);
}
.gb.art.round {
  min-width: var(--h);
}
/* CSS 板件 */
.gb-plate {
  position: absolute;
  inset: 0;
  border-radius: calc(var(--h) * 0.32);
  background: var(--c-face);
  box-shadow:
    inset 0 0 0 2px var(--sk-gold-4),
    inset 0 0 0 4px var(--sk-gold-2),
    inset 0 0 0 5px rgba(255, 244, 200, 0.55),
    inset 0 calc(var(--h) * 0.12) calc(var(--h) * 0.2) rgba(255, 255, 255, 0.28),
    inset 0 calc(var(--h) * -0.16) calc(var(--h) * 0.2) rgba(0, 0, 0, 0.35);
}
.gb.round .gb-plate {
  border-radius: 50%;
}
.gb.v-gold {
  --c-face: linear-gradient(180deg, #ffe38b 0%, #f9c245 48%, #ef9a1f 52%, #ffcf5a 100%);
  color: var(--sk-ink);
}
.gb.v-gold .gb-label {
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.45);
}
.gb.v-blue {
  --c-face: linear-gradient(180deg, #4f8dff 0%, #1f55d6 48%, #143f9e 52%, #2a63d8 100%);
}
.gb.v-green {
  --c-face: linear-gradient(180deg, #9cf27a 0%, #3fbf3a 48%, #1f8a2b 52%, #4cc74a 100%);
}
.gb.v-red {
  --c-face: linear-gradient(180deg, #ff7d6a 0%, #e0261f 48%, #a3120f 52%, #ea4a37 100%);
}
.gb.v-purple {
  --c-face: linear-gradient(180deg, #d59bff 0%, #8f3fd6 48%, #5c1f9a 52%, #a25ae6 100%);
}
.gb.v-orange {
  --c-face: linear-gradient(180deg, #ffc16a 0%, #f8801f 48%, #c8520a 52%, #ff9a3a 100%);
}
.gb.v-dark {
  --c-face: linear-gradient(180deg, #3a4257 0%, #1d2334 48%, #10141f 52%, #242b3d 100%);
}
.gb.v-ghost .gb-plate {
  background: rgba(10, 16, 30, 0.55);
  box-shadow: inset 0 0 0 1.5px rgba(248, 199, 74, 0.55);
}
.gb-content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: calc(var(--h) * 0.18);
}
.gb-content.hidden {
  visibility: hidden;
}
.gb-icon {
  height: calc(var(--h) * 0.72);
  width: auto;
  pointer-events: none;
}
.gb.round .gb-icon {
  height: calc(var(--h) * 0.62);
}
.gb-label {
  text-shadow: var(--sk-outline);
  line-height: 1;
}
.gb-badge {
  position: absolute;
  z-index: 2;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: linear-gradient(180deg, #ff6b5a, #c8161a);
  box-shadow:
    0 0 0 2px #ffe28a,
    0 2px 6px rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 20px;
  text-align: center;
}
.gb-spin {
  position: absolute;
  z-index: 3;
  width: calc(var(--h) * 0.5);
  height: calc(var(--h) * 0.5);
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: gb-rot 800ms linear infinite;
}
@keyframes gb-rot {
  to {
    transform: rotate(360deg);
  }
}
/* 悬停扫光 */
.gb-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
}
.gb-shine::after {
  content: '';
  position: absolute;
  top: -20%;
  left: -60%;
  width: 40%;
  height: 140%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  transform: skewX(-20deg);
  transition: left 0s;
}
.gb:hover:not(:disabled) .gb-shine::after {
  left: 130%;
  transition: left 600ms var(--ease-out);
}
</style>
