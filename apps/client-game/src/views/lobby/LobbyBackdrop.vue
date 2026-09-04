<template>
  <!--
    大厅背景 v4「延边之夜」—— 全部原创 SVG，无第三方素材
    L1 远景：深蓝夜幕 + 星光（缓慢闪烁）+ 薄雾 + 冷月
    L2 中景：长白山四层山脊（大气透视）+ 主峰天池（湖面微光）+ 松林剪影
    L3 前景：海兰江水纹（缓慢流动）+ 朝鲜族窗棂式菱格纹（低对比）+ 舞台光 + 暗角 + 金色微粒
    减少动态：星光 / 水纹 / 微粒动画全部停止（html.reduce-motion .motion-loop）
  -->
  <div class="backdrop" aria-hidden="true">
    <svg class="layer" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bdSky" x1="0" y1="0" x2="0.08" y2="1">
          <stop offset="0" stop-color="#040915" />
          <stop offset="0.35" stop-color="#091634" />
          <stop offset="0.7" stop-color="#0c1f44" />
          <stop offset="1" stop-color="#081431" />
        </linearGradient>
        <radialGradient id="bdStage" cx="0.5" cy="0.46" r="0.62">
          <stop offset="0" stop-color="#2b5aa8" stop-opacity="0.42" />
          <stop offset="0.5" stop-color="#173a78" stop-opacity="0.18" />
          <stop offset="1" stop-color="#081431" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="bdVignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.62" />
        </radialGradient>
        <radialGradient id="bdMoon" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stop-color="#fff8e4" />
          <stop offset="0.6" stop-color="#e9dcb8" />
          <stop offset="1" stop-color="#c7b58d" />
        </radialGradient>
        <radialGradient id="bdLake" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#9fe6ff" stop-opacity="0.95" />
          <stop offset="0.7" stop-color="#4fb6e8" stop-opacity="0.6" />
          <stop offset="1" stop-color="#4fb6e8" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="bdRidge1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22437f" /><stop offset="1" stop-color="#132a58" /></linearGradient>
        <linearGradient id="bdRidge2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173263" /><stop offset="1" stop-color="#0f2249" /></linearGradient>
        <linearGradient id="bdRidge3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10254f" /><stop offset="1" stop-color="#0a1a3d" /></linearGradient>
        <linearGradient id="bdRidge4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1d42" /><stop offset="1" stop-color="#071431" /></linearGradient>
        <linearGradient id="bdWave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#7fc4f0" stop-opacity="0" />
          <stop offset="0.2" stop-color="#7fc4f0" stop-opacity="0.55" />
          <stop offset="0.8" stop-color="#7fc4f0" stop-opacity="0.55" />
          <stop offset="1" stop-color="#7fc4f0" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="bdMist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7d9ccf" stop-opacity="0" />
          <stop offset="0.5" stop-color="#7d9ccf" stop-opacity="0.22" />
          <stop offset="1" stop-color="#7d9ccf" stop-opacity="0" />
        </linearGradient>
        <filter id="bdBlur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="28" /></filter>
        <filter id="bdGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
        <!-- 朝鲜族窗棂式菱格纹（几何抽象，非具象纹样） -->
        <pattern id="bdLattice" width="96" height="96" patternUnits="userSpaceOnUse">
          <path d="M48 4 L92 48 L48 92 L4 48 Z" fill="none" stroke="#e2c07a" stroke-opacity="0.11" stroke-width="1" />
          <path d="M48 26 L70 48 L48 70 L26 48 Z" fill="none" stroke="#e2c07a" stroke-opacity="0.08" stroke-width="1" />
          <circle cx="48" cy="48" r="3" fill="#e2c07a" fill-opacity="0.1" />
          <path d="M0 48 H14 M82 48 H96 M48 0 V14 M48 82 V96" stroke="#e2c07a" stroke-opacity="0.07" stroke-width="1" />
        </pattern>
        <mask id="bdCrescent">
          <circle cx="1690" cy="150" r="46" fill="#fff" />
          <circle cx="1670" cy="138" r="43" fill="#000" />
        </mask>
      </defs>

      <!-- L1 夜幕 -->
      <rect width="1920" height="1080" fill="url(#bdSky)" />
      <g class="stars">
        <circle v-for="(s, i) in stars" :key="i" class="star motion-loop" :cx="s.x" :cy="s.y" :r="s.r" fill="#fff6dc" :style="{ '--d': `${s.d}s`, '--p': `${s.p}s`, opacity: s.o }" />
      </g>
      <ellipse cx="560" cy="330" rx="520" ry="80" fill="url(#bdMist)" filter="url(#bdBlur)" />
      <ellipse cx="1380" cy="420" rx="600" ry="70" fill="url(#bdMist)" filter="url(#bdBlur)" opacity="0.8" />
      <circle cx="1690" cy="150" r="70" fill="#fff3d6" opacity="0.06" filter="url(#bdGlow)" />
      <circle cx="1690" cy="150" r="46" fill="url(#bdMoon)" mask="url(#bdCrescent)" opacity="0.92" />

      <!-- L2 长白山 -->
      <path d="M0 640 L120 600 L260 560 L380 590 L520 520 L640 560 L760 500 L900 540 L1040 470 L1160 520 L1300 480 L1420 540 L1560 500 L1700 560 L1820 520 L1920 560 V1080 H0 Z" fill="url(#bdRidge1)" opacity="0.85" />
      <!-- 主峰 + 天池（火山口湖） -->
      <path d="M700 700 L820 590 L880 560 L920 540 L980 545 L1040 560 L1090 600 L1200 700 Z" fill="url(#bdRidge2)" />
      <path d="M880 560 L920 540 L980 545 L1040 560 L1020 572 L960 566 L900 574 Z" fill="#dbe7ff" opacity="0.55" />
      <path d="M905 556 L925 546 L945 552 L935 560 Z M985 550 L1010 556 L1000 564 L980 560 Z" fill="#f3f7ff" opacity="0.75" />
      <ellipse cx="960" cy="574" rx="58" ry="9" fill="url(#bdLake)" />
      <ellipse cx="960" cy="574" rx="80" ry="16" fill="#7fd4ff" opacity="0.18" filter="url(#bdGlow)" />
      <path d="M0 760 L140 700 L280 730 L420 660 L560 720 L700 680 L860 740 L1000 690 L1140 750 L1280 700 L1420 760 L1560 710 L1700 770 L1840 720 L1920 750 V1080 H0 Z" fill="url(#bdRidge2)" />
      <path d="M0 860 L160 810 L300 850 L460 790 L600 840 L760 800 L920 860 L1080 810 L1240 870 L1400 820 L1560 880 L1720 830 L1920 870 V1080 H0 Z" fill="url(#bdRidge3)" />
      <!-- 松林剪影 -->
      <g fill="#071431" opacity="0.9">
        <path v-for="(p, i) in pines" :key="'p' + i" :transform="`translate(${p.x} ${p.y}) scale(${p.s})`" d="M0 -60 L14 -28 L7 -28 L20 0 L11 0 L24 26 L-24 26 L-11 0 L-20 0 L-7 -28 L-14 -28 Z" />
      </g>
      <path d="M0 940 L200 900 L400 930 L600 890 L800 940 L1000 900 L1200 950 L1400 900 L1600 940 L1800 900 L1920 930 V1080 H0 Z" fill="url(#bdRidge4)" />

      <!-- L3 海兰江水纹（缓慢流动） -->
      <g class="river">
        <path class="wave motion-loop" d="M-240 985 q60 -14 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0" fill="none" stroke="url(#bdWave)" stroke-width="2.4" stroke-linecap="round" />
        <path class="wave w2 motion-loop" d="M-240 1015 q60 -12 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0" fill="none" stroke="url(#bdWave)" stroke-width="2" stroke-linecap="round" opacity="0.7" />
        <path class="wave w3 motion-loop" d="M-240 1045 q60 -10 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0" fill="none" stroke="url(#bdWave)" stroke-width="1.6" stroke-linecap="round" opacity="0.5" />
      </g>
      <!-- 菱格纹带（顶部 / 底部，低对比） -->
      <rect x="0" y="0" width="1920" height="70" fill="url(#bdLattice)" opacity="0.7" />
      <rect x="0" y="960" width="1920" height="120" fill="url(#bdLattice)" opacity="0.55" />
      <!-- 舞台光 + 暗角 -->
      <rect width="1920" height="1080" fill="url(#bdStage)" />
      <rect width="1920" height="1080" fill="url(#bdVignette)" />
      <!-- 金色微粒 -->
      <g class="motes">
        <circle v-for="(m, i) in motes" :key="'m' + i" class="mote motion-loop" :cx="m.x" :cy="m.y" :r="m.r" fill="#f3d58a" :style="{ '--d': `${m.d}s`, '--p': `${m.p}s` }" />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
/** 星 / 微粒 / 松树位置用固定种子生成，保证每次渲染一致（可复现、无随机跳动） */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rnd = lcg(20260904);
const stars = Array.from({ length: 70 }, () => ({
  x: Math.round(rnd() * 1920),
  y: Math.round(rnd() * 560),
  r: +(0.7 + rnd() * 1.3).toFixed(2),
  o: +(0.35 + rnd() * 0.6).toFixed(2),
  d: +(rnd() * 6).toFixed(2),
  p: +(3 + rnd() * 4).toFixed(2),
}));
const motes = Array.from({ length: 16 }, () => ({
  x: Math.round(120 + rnd() * 1680),
  y: Math.round(500 + rnd() * 520),
  r: +(1.2 + rnd() * 1.8).toFixed(2),
  d: +(rnd() * 10).toFixed(2),
  p: +(9 + rnd() * 8).toFixed(2),
}));
const pines = [
  ...Array.from({ length: 9 }, (_, i) => ({ x: 40 + i * 42 + Math.round(rnd() * 14), y: 900 - Math.round(rnd() * 20), s: +(0.55 + rnd() * 0.45).toFixed(2) })),
  ...Array.from({ length: 9 }, (_, i) => ({ x: 1540 + i * 42 + Math.round(rnd() * 14), y: 905 - Math.round(rnd() * 20), s: +(0.55 + rnd() * 0.45).toFixed(2) })),
];
</script>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: #081431;
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.star {
  animation: bd-twinkle var(--p, 4s) ease-in-out var(--d, 0s) infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes bd-twinkle {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}
.wave {
  animation: bd-drift 14s linear infinite;
}
.wave.w2 {
  animation-duration: 19s;
  animation-direction: reverse;
}
.wave.w3 {
  animation-duration: 24s;
}
@keyframes bd-drift {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(240px);
  }
}
.mote {
  opacity: 0;
  animation: bd-mote var(--p, 12s) ease-in-out var(--d, 0s) infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes bd-mote {
  0% {
    opacity: 0;
    transform: translateY(0);
  }
  15% {
    opacity: 0.85;
  }
  85% {
    opacity: 0.3;
  }
  100% {
    opacity: 0;
    transform: translateY(-140px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .star,
  .wave,
  .mote {
    animation: none;
  }
  .mote {
    opacity: 0.5;
  }
}
</style>
