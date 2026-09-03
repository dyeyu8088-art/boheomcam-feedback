<template>
  <nav class="gn" role="tablist">
    <button
      v-for="item in items"
      :key="item.key"
      class="gn-item"
      :class="{ on: modelValue === item.key }"
      role="tab"
      :aria-selected="modelValue === item.key"
      type="button"
      @click="select(item.key)"
    >
      <span class="gn-plate" />
      <img class="gn-icon" :src="item.icon" alt="" draggable="false" />
      <span class="gn-label">{{ item.label }}</span>
      <span v-if="item.badge" class="gn-badge num">{{ item.badge }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { audio } from '../audio/AudioManager.js';

export interface NavItem {
  key: string;
  icon: string;
  label: string;
  badge?: number | string;
}
/** 底部导航：选中 = 红金板，未选 = 蓝金板；图标来自素材，文字程序绘制（双语） */
defineProps<{ items: NavItem[]; modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', key: string): void }>();
function select(key: string): void {
  audio.sfx('tab');
  emit('update:modelValue', key);
}
</script>

<style scoped>
.gn {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(8, 20, 60, 0.9), rgba(4, 10, 34, 0.95));
  box-shadow:
    inset 0 0 0 1.5px #7d4d0c,
    inset 0 0 0 3px #f0c14e,
    inset 0 6px 12px rgba(255, 255, 255, 0.06),
    0 -6px 24px rgba(0, 0, 0, 0.5);
}
.gn-item {
  --h: 54px;
  position: relative;
  flex: 1 1 0;
  min-width: 96px;
  height: var(--h);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: #fff;
  font: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms var(--ease-out);
}
.gn-item:active {
  transform: scale(0.95);
}
.gn-plate {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: linear-gradient(180deg, #3d78e8 0%, #1e4fbe 48%, #123a94 52%, #2a5fd0 100%);
  box-shadow:
    inset 0 0 0 2px #7d4d0c,
    inset 0 0 0 3.5px #f0c14e,
    inset 0 5px 10px rgba(255, 255, 255, 0.28),
    inset 0 -6px 10px rgba(0, 0, 0, 0.35);
  transition:
    background 200ms var(--ease-out),
    filter 200ms var(--ease-out);
}
.gn-item.on .gn-plate {
  background: linear-gradient(180deg, #ff7f5f 0%, #e12a1c 48%, #a8130e 52%, #f04a30 100%);
  filter: drop-shadow(0 0 10px rgba(255, 120, 60, 0.6));
}
.gn-item:hover:not(.on) .gn-plate {
  filter: brightness(1.1);
}
.gn-icon {
  position: relative;
  z-index: 1;
  height: calc(var(--h) * 0.68);
  width: auto;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
  transition: transform 200ms var(--ease-out);
}
.gn-item.on .gn-icon {
  transform: translateY(-2px) scale(1.08);
}
.gn-label {
  position: relative;
  z-index: 1;
  text-shadow: var(--sk-outline);
  white-space: nowrap;
}
.gn-badge {
  position: absolute;
  z-index: 2;
  top: 4px;
  right: 8px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: linear-gradient(180deg, #ff6b5a, #c8161a);
  box-shadow: 0 0 0 2px #ffe28a;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
@media (max-width: 720px) {
  .gn-item {
    min-width: 0;
    padding: 0 6px;
    font-size: 12px;
    gap: 4px;
  }
  .gn-icon {
    height: calc(var(--h) * 0.55);
  }
}
</style>
