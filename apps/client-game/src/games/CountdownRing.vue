<template>
  <div class="ring">
    <svg viewBox="0 0 36 36">
      <circle class="track" cx="18" cy="18" r="15.5" />
      <circle class="bar" cx="18" cy="18" r="15.5" :style="{ strokeDashoffset: offset, stroke: color }" />
    </svg>
    <span class="sec num">{{ remain }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{ deadline: number }>();
const now = ref(Date.now());
let timer = 0;
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 250);
});
onBeforeUnmount(() => window.clearInterval(timer));

const remain = computed(() => Math.max(0, Math.ceil((props.deadline - now.value) / 1000)));
const total = 15;
const C = 2 * Math.PI * 15.5;
const offset = computed(() => `${C * (1 - Math.min(1, remain.value / total))}`);
const color = computed(() => (remain.value <= 5 ? 'var(--accent-crimson)' : 'var(--gold-warm)'));
</script>

<style scoped>
.ring {
  position: relative;
  width: 30px;
  height: 30px;
}
svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.track {
  fill: none;
  stroke: rgba(154, 163, 178, 0.2);
  stroke-width: 3;
}
.bar {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 97.4;
  transition: stroke-dashoffset 0.25s linear;
}
.sec {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: var(--text-primary);
}
</style>
