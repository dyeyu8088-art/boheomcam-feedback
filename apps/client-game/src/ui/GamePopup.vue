<template>
  <Teleport to="body">
    <Transition name="gp">
      <div v-if="modelValue" class="gp-mask" @click.self="closable && close()">
        <div class="gp" :class="[skin, size]" role="dialog" aria-modal="true">
          <!-- 顶部绶带标题 -->
          <div v-if="title" class="gp-ribbon">
            <span class="gp-ribbon-txt">{{ title }}</span>
          </div>
          <button v-if="closable" class="gp-close" type="button" :aria-label="t('common.close')" @click="close">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
          </button>
          <div class="gp-body" :class="{ 'no-title': !title }">
            <slot />
          </div>
          <div v-if="$slots.footer" class="gp-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { t } from '../i18n/index.js';
import { audio } from '../audio/AudioManager.js';

/**
 * 通用弹窗：金框 + 绶带标题（CSS 实现，任意尺寸不拉伸位图）；四种皮肤对应素材表的蓝 / 红 / 黑 / 米色底。
 * 打开 / 关闭有缩放弹出动画与音效；Esc 可关闭。
 */
const props = withDefaults(defineProps<{ modelValue: boolean; title?: string; skin?: 'blue' | 'red' | 'black' | 'cream'; size?: 'sm' | 'md' | 'lg' | 'xl'; closable?: boolean }>(), {
  skin: 'blue',
  size: 'md',
  closable: true,
});
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'close'): void }>();
function close(): void {
  audio.sfx('close');
  emit('update:modelValue', false);
  emit('close');
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.closable && props.modelValue) close();
}
watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      audio.sfx('open');
      window.addEventListener('keydown', onKey);
    } else window.removeEventListener('keydown', onKey);
  },
  { immediate: true },
);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.gp-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(var(--safe-top), 16px) max(var(--safe-right), 16px) max(var(--safe-bottom), 16px) max(var(--safe-left), 16px);
  background: radial-gradient(ellipse at 50% 40%, rgba(10, 20, 60, 0.55), rgba(0, 0, 0, 0.78));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.gp {
  position: relative;
  width: min(92vw, 520px);
  max-height: min(88vh, 760px);
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  padding: 6px;
  background: linear-gradient(180deg, #ffe9a6, #f0c14e 30%, #b8791e 70%, #ffe28a);
  box-shadow:
    0 0 0 2px #5a3305,
    0 24px 60px rgba(0, 0, 0, 0.7),
    0 0 40px rgba(248, 199, 74, 0.25);
}
.gp.sm {
  width: min(92vw, 380px);
}
.gp.lg {
  width: min(94vw, 760px);
}
.gp.xl {
  width: min(96vw, 1040px);
}
.gp-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 16px;
  padding: 34px 22px 18px;
  color: #fff;
  background: linear-gradient(180deg, #1a3a86, #0b1c55 55%, #071238);
  box-shadow:
    inset 0 0 0 2px #5a3305,
    inset 0 12px 30px rgba(255, 255, 255, 0.07),
    inset 0 -20px 40px rgba(0, 0, 0, 0.35);
}
.gp-body.no-title {
  padding-top: 22px;
}
.gp.red .gp-body {
  background: linear-gradient(180deg, #9c1616, #5f0c0c 55%, #3b0606);
}
.gp.black .gp-body {
  background: linear-gradient(180deg, #2a2d36, #14161d 55%, #08090d);
}
.gp.cream .gp-body {
  background: linear-gradient(180deg, #fff8e6, #f7e5ba 60%, #efd59d);
  color: #4a2a06;
}
.gp-footer {
  display: flex;
  justify-content: center;
  gap: 14px;
  padding: 12px 10px 8px;
}
/* 绶带标题 */
.gp-ribbon {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  min-width: 46%;
  max-width: 86%;
  height: 46px;
  padding: 0 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #ff6b57 0%, #d81f1f 45%, #9c0f12 100%);
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 2px #5a3305,
    inset 0 0 0 4px #ffd867,
    inset 0 6px 8px rgba(255, 255, 255, 0.28),
    0 8px 16px rgba(0, 0, 0, 0.55);
}
.gp-ribbon::before,
.gp-ribbon::after {
  content: '';
  position: absolute;
  top: 8px;
  width: 26px;
  height: 30px;
  background: linear-gradient(180deg, #b01414, #6a0a0a);
  z-index: -1;
  box-shadow: inset 0 0 0 2px #d8a13a;
}
.gp-ribbon::before {
  left: -18px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 40% 50%);
}
.gp-ribbon::after {
  right: -18px;
  clip-path: polygon(0 0, 100% 0, 60% 50%, 100% 100%, 0 100%);
}
.gp-ribbon-txt {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #fff6d5;
  text-shadow: var(--sk-outline);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gp-close {
  position: absolute;
  top: -12px;
  right: -12px;
  z-index: 3;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #ff7a68, #c8161a 60%, #7a0a10);
  box-shadow:
    inset 0 0 0 2.5px #ffd867,
    inset 0 0 0 4px #5a3305,
    0 4px 10px rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 120ms var(--ease-out);
}
.gp-close:hover {
  transform: scale(1.08);
}
.gp-close:active {
  transform: scale(0.92);
}
/* 动画 */
.gp-enter-active {
  transition: opacity 200ms var(--ease-out);
}
.gp-leave-active {
  transition: opacity 160ms var(--ease-out);
}
.gp-enter-from,
.gp-leave-to {
  opacity: 0;
}
.gp-enter-active .gp {
  animation: gp-pop 280ms var(--ease-out);
}
@keyframes gp-pop {
  0% {
    transform: scale(0.82) translateY(16px);
    opacity: 0;
  }
  60% {
    transform: scale(1.03);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
</style>
