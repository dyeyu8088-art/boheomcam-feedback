<template>
  <div class="cb" :class="[kind, size, { addable }]" @click="addable && $emit('add')">
    <img class="cb-plate" :src="plate" alt="" draggable="false" />
    <img class="cb-icon" :src="icon" alt="" draggable="false" />
    <AnimatedNumber class="cb-num" :value="value" :raw="raw" />
    <span v-if="addable" class="cb-add">+</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AnimatedNumber from './AnimatedNumber.vue';
import { asset } from '../assets/assets.js';

/**
 * 资产胶囊：素材只提供底板与图标，数字由 AnimatedNumber 滚动绘制（余额来自服务器）。
 * `addable` 时右侧出现 + 号，点击 emit('add') 交给调用方打开商城 / 福利。
 */
const props = withDefaults(defineProps<{ kind: 'coin' | 'diamond'; value: number; size?: 'md' | 'wide'; addable?: boolean; raw?: boolean }>(), {
  size: 'md',
  addable: false,
  raw: false,
});
defineEmits<{ (e: 'add'): void }>();
const plate = computed(() => (props.kind === 'coin' ? asset('common', props.size === 'wide' ? 'plateCoinWide' : 'plateCoin') : asset('common', props.size === 'wide' ? 'plateDiamondWide' : 'plateDiamond')));
const icon = computed(() => (props.kind === 'coin' ? asset('common', 'coinYanbian') : asset('common', 'iconGemBlue')));
</script>

<style scoped>
.cb {
  --h: 40px;
  position: relative;
  display: inline-flex;
  align-items: center;
  height: var(--h);
  min-width: calc(var(--h) * 4.2);
  padding: 0 calc(var(--h) * 0.5) 0 calc(var(--h) * 1.05);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45));
}
.cb.wide {
  min-width: calc(var(--h) * 5.6);
}
.cb.addable {
  cursor: pointer;
  padding-right: calc(var(--h) * 0.95);
}
.cb.addable:active {
  transform: scale(0.97);
}
.cb-plate {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}
.cb-icon {
  position: absolute;
  left: calc(var(--h) * -0.12);
  top: 50%;
  height: calc(var(--h) * 1.12);
  width: auto;
  transform: translateY(-50%);
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}
.cb-num {
  position: relative;
  z-index: 1;
  flex: 1;
  text-align: right;
  font-size: calc(var(--h) * 0.42);
  font-weight: 800;
  color: #fff3c4;
  text-shadow:
    0 1px 0 #3a2200,
    0 2px 4px rgba(0, 0, 0, 0.6);
}
.cb-add {
  position: absolute;
  right: calc(var(--h) * 0.12);
  top: 50%;
  width: calc(var(--h) * 0.68);
  height: calc(var(--h) * 0.68);
  transform: translateY(-50%);
  border-radius: 50%;
  background: linear-gradient(180deg, #9cf27a, #22a83a 55%, #157a2a);
  box-shadow:
    inset 0 0 0 2px #ffe28a,
    inset 0 2px 0 rgba(255, 255, 255, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: calc(var(--h) * 0.5);
  font-weight: 900;
  line-height: calc(var(--h) * 0.66);
  text-align: center;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
}
</style>
