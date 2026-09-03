<template>
  <!--
    大厅三层空间背景 v3 —— 长白山夜色
    L1 远景：深夜天幕 + 银河雾 + 极光 + 冷月（泛光/月光束）+ 五层山脊（大气透视）+ 主峰雪冠（月光轮廓光）+ 松林
    L2 中景：雾带 + 舞台光（四周暗、中央微亮）
    L3 前景：金色微粒 + 胶片颗粒 + 暗角
  -->
  <div class="backdrop">
    <svg class="layer far" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bdSky" x1="0" y1="0" x2="0.1" y2="1">
          <stop offset="0" stop-color="#050912" />
          <stop offset="0.3" stop-color="#0a1428" />
          <stop offset="0.62" stop-color="#0d1a30" />
          <stop offset="1" stop-color="#060b14" />
        </linearGradient>
        <linearGradient id="bdAurora" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4fb6c8" stop-opacity="0" />
          <stop offset="0.4" stop-color="#4fb6c8" stop-opacity="0.42" />
          <stop offset="0.75" stop-color="#5a6fd6" stop-opacity="0.2" />
          <stop offset="1" stop-color="#5a6fd6" stop-opacity="0" />
        </linearGradient>
        <mask id="bdCrescent">
          <circle cx="1712" cy="150" r="44" fill="#fff" />
          <circle cx="1693" cy="139" r="41" fill="#000" />
        </mask>
        <radialGradient id="bdMoon" cx="0.36" cy="0.32" r="0.8">
          <stop offset="0" stop-color="#fff8e4" />
          <stop offset="0.55" stop-color="#eadbb4" />
          <stop offset="1" stop-color="#c9b488" />
        </radialGradient>
        <radialGradient id="bdStage" cx="0.5" cy="0.47" r="0.6">
          <stop offset="0" stop-color="#2e5486" stop-opacity="0.5" />
          <stop offset="0.45" stop-color="#16294a" stop-opacity="0.22" />
          <stop offset="1" stop-color="#0a1428" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="bdSnow" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stop-color="#f4f8ff" />
          <stop offset="0.6" stop-color="#c6d6ee" />
          <stop offset="1" stop-color="#8ea6c9" />
        </linearGradient>
        <linearGradient id="bdRimGold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#f3dfae" stop-opacity="0" />
          <stop offset="0.5" stop-color="#f3dfae" stop-opacity="0.9" />
          <stop offset="1" stop-color="#f3dfae" stop-opacity="0.2" />
        </linearGradient>
        <linearGradient id="bdMist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#6f8fbd" stop-opacity="0" />
          <stop offset="0.5" stop-color="#6f8fbd" stop-opacity="0.2" />
          <stop offset="1" stop-color="#6f8fbd" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="bdBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f3dfae" stop-opacity="0.18" />
          <stop offset="1" stop-color="#f3dfae" stop-opacity="0" />
        </linearGradient>
        <pattern id="bdWeave" width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M0 60 H120 M60 0 V120" stroke="#c9a063" stroke-opacity="0.045" stroke-width="1" />
          <path d="M30 30 h60 v60 h-60 z" fill="none" stroke="#c9a063" stroke-opacity="0.04" stroke-width="1" />
          <path d="M60 18 L102 60 L60 102 L18 60 z" fill="none" stroke="#c9a063" stroke-opacity="0.035" stroke-width="1" />
        </pattern>
        <filter id="bdBlurXL" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <filter id="bdBlurL" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="bdBlurM" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="bdGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="bdGrain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.045 0" />
        </filter>
      </defs>

      <!-- 天幕 -->
      <rect width="1920" height="1080" fill="url(#bdSky)" />
      <rect width="1920" height="1080" fill="url(#bdWeave)" />
      <!-- 银河雾 -->
      <path d="M-200 520 C 300 260, 900 200, 1500 60 L1700 -60 L2100 -60 C 1500 260, 900 420, 200 620 z" fill="#8fa8d8" opacity="0.045" filter="url(#bdBlurXL)" />

      <!-- 星 -->
      <g fill="#e9f0ff">
        <circle v-for="(s, i) in stars" :key="`s${i}`" :cx="s[0]" :cy="s[1]" :r="s[2]" :opacity="s[3]" :class="s[4] ? `tw tw${s[4]}` : ''" />
      </g>

      <!-- 极光：只在天顶，是一层轻纱而不是色带 -->
      <g class="aurora">
        <path class="au au-a" d="M-120 90 C 360 20, 760 150, 1160 60 S 1760 30, 2060 90 L2060 200 C 1760 150, 1160 190, 760 280 S 360 150, -120 230 z" fill="url(#bdAurora)" opacity="0.26" filter="url(#bdBlurXL)" />
        <path class="au au-b" d="M-120 170 C 420 110, 760 240, 1160 150 S 1760 130, 2060 190 L2060 250 C 1760 200, 1160 230, 760 320 S 420 210, -120 290 z" fill="url(#bdAurora)" opacity="0.16" filter="url(#bdBlurXL)" />
        <path class="au au-c" d="M1330 -20 L1400 -20 L1470 330 L1350 330 z" fill="url(#bdAurora)" opacity="0.14" filter="url(#bdBlurL)" />
      </g>

      <!-- 冷月：泛光 + 残月（遮罩挖出阴影，透出天幕而不是画一个黑盘） -->
      <circle cx="1712" cy="150" r="150" fill="#f3dfae" opacity="0.1" filter="url(#bdBlurXL)" />
      <circle cx="1712" cy="150" r="72" fill="#fff3d0" opacity="0.22" filter="url(#bdBlurL)" />
      <circle cx="1712" cy="150" r="44" fill="url(#bdMoon)" mask="url(#bdCrescent)" />
      <circle cx="1712" cy="150" r="44" fill="none" stroke="#fff8e4" stroke-opacity="0.16" stroke-width="1" />
      <!-- 月光束 -->
      <g filter="url(#bdBlurL)">
        <path d="M1712 150 L1180 1080 L1330 1080 z" fill="url(#bdBeam)" opacity="0.45" />
        <path d="M1712 150 L1420 1080 L1530 1080 z" fill="url(#bdBeam)" opacity="0.38" />
        <path d="M1712 150 L960 1080 L1050 1080 z" fill="url(#bdBeam)" opacity="0.26" />
      </g>

      <!-- 远山：长白山主峰群，立在顶部天幕带里（卡片之上可见），大气透视偏蓝 -->
      <path :d="FAR" fill="#1b2d52" />
      <g opacity="0.72">
        <path :d="snowCap(640, 130, 40, 54)" fill="url(#bdSnow)" />
        <path :d="snowCap(560, 170, 22, 30)" fill="url(#bdSnow)" opacity="0.85" />
        <path :d="snowCap(800, 160, 24, 32)" fill="url(#bdSnow)" opacity="0.85" />
        <path :d="snowCap(1000, 180, 18, 24)" fill="url(#bdSnow)" opacity="0.7" />
        <path :d="snowCap(380, 190, 16, 22)" fill="url(#bdSnow)" opacity="0.6" />
      </g>
      <g fill="none" stroke="url(#bdRimGold)" stroke-width="2" stroke-linecap="round" filter="url(#bdGlow)" opacity="0.85">
        <path d="M640 130 L720 190 L800 160" />
        <path d="M1000 180 L1120 240" />
      </g>
      <path d="M640 130 L600 184" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round" />
      <!-- 远山薄雾：把远景整体推远（降低对比、偏蓝） -->
      <rect x="0" y="100" width="1920" height="260" fill="#1b2d52" opacity="0.28" />
      <rect x="0" y="180" width="1920" height="150" fill="url(#bdMist)" opacity="0.7" class="mist mist-a" />

      <!-- 中景山：大部分被卡片遮住，只在两侧露出 -->
      <path d="M0 420 L120 360 L240 400 L360 330 L480 390 L600 340 L760 410 L920 350 L1080 420 L1240 360 L1400 430 L1560 370 L1720 440 L1920 390 L1920 1080 L0 1080 z" fill="#111e3a" />

      <!-- 舞台光（天幕层） -->
      <rect width="1920" height="1080" fill="url(#bdStage)" />

      <!-- 两翼：近景山体像舞台侧幕，把视线夹向中央 -->
      <path d="M0 1080 L0 330 L50 260 L120 380 L180 520 L240 690 L290 1080 z" fill="#0c162a" />
      <path d="M1920 1080 L1920 330 L1870 260 L1800 380 L1740 520 L1680 690 L1630 1080 z" fill="#0c162a" />
      <path d="M0 1080 L0 520 L70 460 L140 600 L200 780 L230 1080 z" fill="#080f1d" />
      <path d="M1920 1080 L1920 520 L1850 460 L1780 600 L1720 780 L1690 1080 z" fill="#080f1d" />

      <!-- 近脊：山脊线落在卡片与 Dock 之间的可见带里 -->
      <path d="M0 930 L160 890 L320 920 L480 870 L640 915 L800 880 L960 925 L1120 885 L1280 920 L1440 880 L1600 925 L1760 895 L1920 930 L1920 1080 L0 1080 z" fill="#0a1223" />
      <rect x="0" y="850" width="1920" height="150" fill="url(#bdMist)" class="mist mist-b" />

      <!-- 松林剪影 -->
      <rect x="0" y="1000" width="1920" height="90" fill="#060b15" />
      <g fill="#050a13">
        <path v-for="(p, i) in pines" :key="`p${i}`" :d="pine(p[0], p[1])" />
      </g>

      <!-- 舞台光（薄雾光） -->
      <rect width="1920" height="1080" fill="url(#bdStage)" opacity="0.45" />

      <!-- 胶片颗粒 -->
      <rect width="1920" height="1080" fill="#000" filter="url(#bdGrain)" />
    </svg>

    <!-- L2 中景光晕 -->
    <div class="halo halo-core" />
    <div class="halo halo-warm" />
    <div class="halo halo-cool" />

    <!-- L3 前景微粒 -->
    <div class="motes">
      <span v-for="n in 26" :key="n" class="mote" :style="moteStyle(n)" />
    </div>
    <div class="vignette" />
  </div>
</template>

<script setup lang="ts">
/** 远山（长白山主峰群）：立在顶部天幕带里 —— 主峰 (640,130)，肩峰 (560,170)/(800,160)，东峰 (1000,180) */
const FAR =
  'M0 300 L140 240 L260 270 L380 190 L470 240 L560 170 L640 130 L720 190 L800 160 L900 220 L1000 180 L1120 240 L1240 200 L1360 260 L1480 210 L1600 270 L1720 230 L1820 270 L1920 240 L1920 1080 L0 1080 z';

/** 雪冠：锯齿状雪线，左窄右宽（月光在右，雪在背光面更厚） */
function snowCap(x: number, y: number, w: number, h: number): string {
  return `M${x} ${y} L${x - w} ${y + h} Q${x - w * 0.45} ${y + h * 0.7} ${x - w * 0.1} ${y + h * 0.86} Q${x + w * 0.36} ${y + h * 0.72} ${x + w * 0.96} ${y + h * 1.06} z`;
}

/** 松树剪影：三层叠塔 */
function pine(x: number, h: number): string {
  const b = 1090;
  const w = h * 0.42;
  return [
    `M${x} ${b - h}`,
    `L${x - w * 0.5} ${b - h * 0.62} L${x - w * 0.25} ${b - h * 0.62}`,
    `L${x - w * 0.8} ${b - h * 0.3} L${x - w * 0.45} ${b - h * 0.3}`,
    `L${x - w} ${b} L${x + w} ${b}`,
    `L${x + w * 0.45} ${b - h * 0.3} L${x + w * 0.8} ${b - h * 0.3}`,
    `L${x + w * 0.25} ${b - h * 0.62} L${x + w * 0.5} ${b - h * 0.62} z`,
  ].join(' ');
}

/** 松林：确定性伪随机，两侧密、中央疏（中央是 Dock 与内容区） */
const pines: [number, number][] = Array.from({ length: 48 }, (_, i) => {
  const x = i * 41 + ((i * 37) % 22);
  const edge = Math.min(x, 1920 - x);
  const scale = edge < 520 ? 1 : 0.55;
  const h = (30 + ((i * 53) % 44)) * scale;
  return [x, h];
});

/** 星空：46 颗，10 颗闪烁 */
const stars: [number, number, number, number, number][] = Array.from({ length: 46 }, (_, i) => {
  const x = ((i * 397) % 1900) + 10;
  const y = ((i * 211) % 440) + 20;
  const r = 0.8 + ((i * 7) % 5) * 0.25;
  const o = 0.28 + ((i * 11) % 10) / 18;
  const tw = i % 5 === 0 ? (i % 3) + 1 : 0;
  return [x, y, r, o, tw];
});

function moteStyle(n: number): Record<string, string> {
  const left = (n * 47 + (n % 5) * 7) % 100;
  const size = n % 4 === 0 ? 3 : n % 3 === 0 ? 2 : 1.5;
  return {
    left: `${left}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${((n * 1.37) % 14).toFixed(2)}s`,
    animationDuration: `${(16 + ((n * 1.9) % 12)).toFixed(1)}s`,
    opacity: `${0.25 + ((n * 7) % 40) / 100}`,
  };
}
</script>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--bg-abyss);
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
/* 星光闪烁：三组相位 */
.tw {
  animation: twinkle 3.6s ease-in-out infinite;
}
.tw2 {
  animation-duration: 4.8s;
  animation-delay: 1.1s;
}
.tw3 {
  animation-duration: 5.6s;
  animation-delay: 2.3s;
}
@keyframes twinkle {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
}
/* 极光：极慢漂移 + 呼吸 */
.au-a {
  animation: aurora-drift 42s ease-in-out infinite alternate;
}
.au-b {
  animation: aurora-drift 56s ease-in-out infinite alternate-reverse;
}
.au-c {
  animation: aurora-breathe 18s ease-in-out infinite alternate;
  transform-origin: 1400px 40px;
}
@keyframes aurora-drift {
  0% {
    transform: translateX(-60px);
    opacity: 0.7;
  }
  100% {
    transform: translateX(60px);
    opacity: 1;
  }
}
@keyframes aurora-breathe {
  0% {
    transform: scaleX(0.8);
    opacity: 0.5;
  }
  100% {
    transform: scaleX(1.3);
    opacity: 1;
  }
}
.mist {
  animation: mist-drift 34s ease-in-out infinite alternate;
  transform-origin: center;
}
.mist-b {
  animation-duration: 46s;
  animation-direction: alternate-reverse;
}
@keyframes mist-drift {
  0% {
    transform: translateX(-3%) scaleY(1);
    opacity: 0.75;
  }
  100% {
    transform: translateX(3%) scaleY(1.25);
    opacity: 1;
  }
}
.halo {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
}
.halo-core {
  width: 62vw;
  height: 42vh;
  left: 50%;
  top: 36%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(62, 100, 160, 0.3) 0%, rgba(30, 48, 80, 0.14) 45%, transparent 72%);
}
.halo-warm {
  width: 30vw;
  height: 30vw;
  right: -6vw;
  top: -8vh;
  background: rgba(201, 160, 99, 0.1);
  animation: float-slow 16s ease-in-out infinite;
}
.halo-cool {
  width: 26vw;
  height: 26vw;
  left: -6vw;
  bottom: 4vh;
  background: rgba(62, 140, 165, 0.12);
  animation: float-slow 20s ease-in-out infinite reverse;
}
.motes {
  position: absolute;
  inset: 0;
}
.mote {
  position: absolute;
  bottom: -10px;
  border-radius: 50%;
  background: var(--gold-champagne);
  box-shadow: 0 0 6px rgba(230, 207, 163, 0.55);
  animation: mote-rise linear infinite;
}
@keyframes mote-rise {
  0% {
    transform: translate3d(0, 0, 0);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  88% {
    opacity: 0.6;
  }
  100% {
    transform: translate3d(24px, -108vh, 0);
    opacity: 0;
  }
}
.vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(118% 86% at 50% 44%, transparent 40%, rgba(3, 6, 12, 0.6) 100%),
    linear-gradient(180deg, rgba(3, 6, 12, 0.42) 0%, transparent 20%, transparent 74%, rgba(3, 6, 12, 0.66) 100%);
}
</style>
