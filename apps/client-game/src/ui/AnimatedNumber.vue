<template>
  <span class="an num" :class="{ up: dir > 0, down: dir < 0 }">{{ text }}</span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { fmt } from './format.js';

/**
 * 数字滚动：值变化时从旧值补间到新值（易出曲线），金币 / Jackpot / 分数通用。
 * `format` 默认用万 / 亿缩写的 fmt；传 `raw` 显示完整千分位。
 */
const props = withDefaults(defineProps<{ value: number; duration?: number; raw?: boolean; decimals?: number }>(), {
  duration: 650,
  raw: false,
  decimals: 0,
});

const shown = ref(props.value);
const dir = ref(0);
const text = ref(render(props.value));
let raf = 0;
let dirTimer = 0;

function render(v: number): string {
  if (props.raw) return props.decimals > 0 ? v.toFixed(props.decimals) : Math.round(v).toLocaleString('en-US');
  return fmt(Math.round(v));
}

watch(
  () => props.value,
  (to) => {
    cancelAnimationFrame(raf);
    const from = shown.value;
    if (to === from) return;
    dir.value = to > from ? 1 : -1;
    clearTimeout(dirTimer);
    dirTimer = window.setTimeout(() => (dir.value = 0), props.duration + 200);
    const t0 = performance.now();
    const step = (now: number): void => {
      const k = Math.min(1, (now - t0) / props.duration);
      const e = 1 - Math.pow(1 - k, 3);
      shown.value = from + (to - from) * e;
      text.value = render(shown.value);
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        shown.value = to;
        text.value = render(to);
      }
    };
    raf = requestAnimationFrame(step);
  },
);
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  clearTimeout(dirTimer);
});
</script>

<style scoped>
.an {
  display: inline-block;
  transition: color 200ms var(--ease-out);
}
.an.up {
  color: #7cf36a;
}
.an.down {
  color: #ff8a7a;
}
</style>
