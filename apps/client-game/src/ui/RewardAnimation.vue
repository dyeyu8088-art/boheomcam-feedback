<template>
  <Teleport to="body">
    <div v-if="active" class="ra" :class="tier">
      <span v-for="c in coins" :key="c.id" class="ra-coin" :style="c.style"><img :src="c.src" alt="" draggable="false" /></span>
      <span v-for="s in sparks" :key="s.id" class="ra-spark" :style="s.style"><img :src="sparkSrc" alt="" /></span>
      <div class="ra-center">
        <img v-if="banner" class="ra-banner" :src="banner" alt="" draggable="false" />
        <div class="ra-amount sk-gold-text num">+<AnimatedNumber :value="shownAmount" raw :duration="rollMs" /></div>
        <div v-if="caption" class="ra-caption">{{ caption }}</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import AnimatedNumber from './AnimatedNumber.vue';
import { asset } from '../assets/assets.js';
import { audio } from '../audio/AudioManager.js';

/**
 * 奖励演出：金币雨 + 闪光 + 金额滚动（+ 可选横幅素材：赢 / 大赢 / WIN）。
 * 由调用方在服务器返回派奖后触发：`play({ amount, tier, banner })`；结束后 emit('done')。
 * 金额只是显示，余额以服务器推送为准。
 */
const emit = defineEmits<{ (e: 'done'): void }>();
const active = ref(false);
const tier = ref<'normal' | 'big' | 'mega' | 'epic'>('normal');
const shownAmount = ref(0);
const rollMs = ref(900);
const banner = ref('');
const caption = ref('');
const coins = ref<{ id: number; src: string; style: Record<string, string> }[]>([]);
const sparks = ref<{ id: number; style: Record<string, string> }[]>([]);
const sparkSrc = asset('common', 'sparkleCoin');
let timer = 0;
let seq = 0;

function play(opts: { amount: number; tier?: 'normal' | 'big' | 'mega' | 'epic'; banner?: string; caption?: string; duration?: number }): void {
  clearTimeout(timer);
  tier.value = opts.tier ?? (opts.amount >= 100000 ? 'epic' : opts.amount >= 20000 ? 'mega' : opts.amount >= 5000 ? 'big' : 'normal');
  banner.value = opts.banner ?? '';
  caption.value = opts.caption ?? '';
  const n = tier.value === 'epic' ? 42 : tier.value === 'mega' ? 30 : tier.value === 'big' ? 20 : 12;
  const srcs = [asset('common', 'coinYanbian')];
  coins.value = Array.from({ length: n }, (_, i) => ({
    id: ++seq,
    src: srcs[i % srcs.length]!,
    style: {
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 600}ms`,
      animationDuration: `${1400 + Math.random() * 900}ms`,
      '--sz': `${22 + Math.random() * 26}px`,
      '--rot': `${Math.random() * 720 - 360}deg`,
    },
  }));
  sparks.value = Array.from({ length: Math.round(n / 2) }, () => ({
    id: ++seq,
    style: { left: `${10 + Math.random() * 80}%`, top: `${20 + Math.random() * 60}%`, animationDelay: `${Math.random() * 900}ms`, '--sz': `${18 + Math.random() * 30}px` },
  }));
  shownAmount.value = 0;
  rollMs.value = opts.duration ?? (tier.value === 'normal' ? 900 : 1600);
  active.value = true;
  audio.sfx(tier.value === 'normal' ? 'coin' : 'win');
  requestAnimationFrame(() => (shownAmount.value = opts.amount));
  timer = window.setTimeout(() => {
    active.value = false;
    emit('done');
  }, (opts.duration ?? 1600) + 1400);
}
function stop(): void {
  clearTimeout(timer);
  active.value = false;
}
onBeforeUnmount(() => clearTimeout(timer));
defineExpose({ play, stop });
</script>

<style scoped>
.ra {
  position: fixed;
  inset: 0;
  z-index: 110;
  pointer-events: none;
  overflow: hidden;
}
.ra.big::before,
.ra.mega::before,
.ra.epic::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, rgba(255, 210, 90, 0.28), transparent 60%);
  animation: ra-flash 600ms var(--ease-out);
}
.ra-coin {
  position: absolute;
  top: -60px;
  width: var(--sz);
  height: var(--sz);
  animation: ra-fall linear both;
}
.ra-coin img {
  width: 100%;
  height: 100%;
  animation: ra-spin 900ms linear infinite;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.5));
}
.ra-spark {
  position: absolute;
  width: var(--sz);
  height: var(--sz);
  animation: ra-spark 800ms var(--ease-out) both;
}
.ra-spark img {
  width: 100%;
  height: 100%;
}
.ra-center {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  animation: ra-pop 500ms var(--ease-out) both;
}
.ra-banner {
  width: min(52vw, 360px);
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6));
}
.ra-amount {
  font-size: clamp(36px, 7vw, 84px);
  line-height: 1;
  letter-spacing: 0.02em;
}
.ra.epic .ra-amount {
  font-size: clamp(48px, 9vw, 110px);
}
.ra-caption {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  text-shadow: var(--sk-outline);
}
@keyframes ra-fall {
  0% {
    transform: translateY(0) rotate(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(var(--rot));
    opacity: 0.9;
  }
}
@keyframes ra-spin {
  0% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(0.15);
  }
  100% {
    transform: scaleX(1);
  }
}
@keyframes ra-spark {
  0% {
    transform: scale(0) rotate(0);
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
  100% {
    transform: scale(1.6) rotate(60deg);
    opacity: 0;
  }
}
@keyframes ra-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.4);
    opacity: 0;
  }
  70% {
    transform: translate(-50%, -50%) scale(1.08);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes ra-flash {
  0% {
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}
</style>
