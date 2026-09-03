<template>
  <div class="cd" :class="[size, { urgent: remain <= urgentAt && remain > 0, done: remain <= 0 }]">
    <svg class="cd-ring" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="17" class="cd-track" />
      <circle cx="20" cy="20" r="17" class="cd-arc" :style="{ strokeDashoffset: dash }" />
    </svg>
    <span class="cd-num num">{{ Math.ceil(remain) }}</span>
    <span v-if="label" class="cd-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { audio } from '../audio/AudioManager.js';

/**
 * 倒计时（服务器 deadline 驱动）：传 `deadlineAt`（服务器时间戳 ms）与 `serverOffset`，
 * 客户端只做显示，不决定超时（超时由服务器广播）。最后 3 秒有滴答音效与红色脉冲。
 */
const props = withDefaults(defineProps<{ deadlineAt: number; totalMs?: number; serverOffset?: number; size?: 'sm' | 'md' | 'lg'; label?: string; urgentAt?: number }>(), {
  totalMs: 15000,
  serverOffset: 0,
  size: 'md',
  urgentAt: 3,
});
const emit = defineEmits<{ (e: 'expire'): void }>();
const remain = ref(0);
let raf = 0;
let lastTick = -1;
let expired = false;
const C = 2 * Math.PI * 17;
const dash = computed(() => C * (1 - Math.max(0, Math.min(1, (remain.value * 1000) / props.totalMs))));

function loop(): void {
  const ms = props.deadlineAt - (Date.now() + props.serverOffset);
  remain.value = Math.max(0, ms / 1000);
  const sec = Math.ceil(remain.value);
  if (sec !== lastTick) {
    lastTick = sec;
    if (sec > 0 && sec <= props.urgentAt) audio.sfx('tick');
  }
  if (ms <= 0) {
    if (!expired) {
      expired = true;
      emit('expire');
    }
    return;
  }
  raf = requestAnimationFrame(loop);
}
watch(
  () => props.deadlineAt,
  () => {
    cancelAnimationFrame(raf);
    expired = false;
    lastTick = -1;
    loop();
  },
);
onMounted(loop);
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<style scoped>
.cd {
  --d: 56px;
  position: relative;
  width: var(--d);
  height: var(--d);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cd.sm {
  --d: 40px;
}
.cd.lg {
  --d: 76px;
}
.cd-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.cd-track {
  fill: rgba(5, 12, 40, 0.8);
  stroke: #7d4d0c;
  stroke-width: 3;
}
.cd-arc {
  fill: none;
  stroke: #f8c74a;
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-dasharray: 106.8;
  transition: stroke 200ms;
  filter: drop-shadow(0 0 3px rgba(248, 199, 74, 0.7));
}
.cd.urgent .cd-arc {
  stroke: #ff5d4d;
}
.cd-num {
  position: relative;
  font-size: calc(var(--d) * 0.42);
  font-weight: 900;
  color: #fff3c4;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  line-height: 1;
}
.cd.urgent .cd-num {
  color: #ff8a7a;
  animation: cd-pulse 1s ease-in-out infinite;
}
.cd.done .cd-num {
  color: #9fb4e8;
}
.cd-label {
  position: absolute;
  bottom: -14px;
  font-size: 10px;
  color: #9fb4e8;
  white-space: nowrap;
}
@keyframes cd-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
}
</style>
