import { ref, watchEffect } from 'vue';

/**
 * 减少动态：系统 prefers-reduced-motion 为默认值，设置页可覆盖（localStorage 'reduceMotion' = '1' | '0'）。
 * 生效方式：<html class="reduce-motion"> → tokens.css 全局关闭 CSS 动画 / 过渡；JS 驱动的粒子 / 游鱼 / 气泡读取 reduceMotion.value 自行跳过。
 */
const media = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
function initial(): boolean {
  try {
    const saved = localStorage.getItem('reduceMotion');
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    /* 隐私模式等无 storage */
  }
  return media?.matches ?? false;
}

export const reduceMotion = ref(initial());

export function setReduceMotion(v: boolean): void {
  reduceMotion.value = v;
  try {
    localStorage.setItem('reduceMotion', v ? '1' : '0');
  } catch {
    /* noop */
  }
}

media?.addEventListener?.('change', (e) => {
  try {
    if (localStorage.getItem('reduceMotion') === null) reduceMotion.value = e.matches;
  } catch {
    reduceMotion.value = e.matches;
  }
});

watchEffect(() => {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', reduceMotion.value);
});
