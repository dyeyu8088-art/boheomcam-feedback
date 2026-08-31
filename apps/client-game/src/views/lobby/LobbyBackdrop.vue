<template>
  <!--
    大厅三层空间背景
    L1 远景：深午夜蓝黑渐场 + 长白山轮廓 + 星尘
    L2 中景：云雾 + 东方暗纹 + 中央柔光（四周暗、中央微亮，把注意力压到游戏卡区）
    L3 前景：金色微粒 + 顶部/底部渐隐（UI 前景由 LobbyView 承载）
  -->
  <div class="backdrop">
    <!-- L1 远景 -->
    <svg class="layer far" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bdSky" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stop-color="#0a1122" />
          <stop offset="0.45" stop-color="#070d18" />
          <stop offset="1" stop-color="#050a11" />
        </linearGradient>
        <radialGradient id="bdCore" cx="0.5" cy="0.44" r="0.62">
          <stop offset="0" stop-color="#1b2a44" stop-opacity="0.85" />
          <stop offset="0.45" stop-color="#0e1a2c" stop-opacity="0.45" />
          <stop offset="1" stop-color="#070c15" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="bdRidgeA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#16233a" />
          <stop offset="1" stop-color="#0b1220" />
        </linearGradient>
        <linearGradient id="bdRidgeB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0e1728" />
          <stop offset="1" stop-color="#080e18" />
        </linearGradient>
        <linearGradient id="bdSnow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c9a063" stop-opacity="0.5" />
          <stop offset="1" stop-color="#c9a063" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="bdMist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4d6f9e" stop-opacity="0" />
          <stop offset="0.5" stop-color="#4d6f9e" stop-opacity="0.13" />
          <stop offset="1" stop-color="#4d6f9e" stop-opacity="0" />
        </linearGradient>
        <pattern id="bdWeave" width="120" height="120" patternUnits="userSpaceOnUse">
          <!-- 朝鲜族/东方几何暗纹（抽象化、极低对比） -->
          <path d="M0 60 H120 M60 0 V120" stroke="#c9a063" stroke-opacity="0.055" stroke-width="1" />
          <path d="M30 30 h60 v60 h-60 z" fill="none" stroke="#c9a063" stroke-opacity="0.05" stroke-width="1" />
          <path d="M60 18 L102 60 L60 102 L18 60 z" fill="none" stroke="#c9a063" stroke-opacity="0.045" stroke-width="1" />
        </pattern>
      </defs>

      <rect width="1920" height="1080" fill="url(#bdSky)" />
      <rect width="1920" height="1080" fill="url(#bdWeave)" />
      <!-- 中央光源 -->
      <rect width="1920" height="1080" fill="url(#bdCore)" />

      <!-- 冷月 -->
      <circle cx="1712" cy="150" r="46" fill="#0d1728" />
      <circle cx="1712" cy="150" r="46" fill="none" stroke="#c9a063" stroke-opacity="0.16" stroke-width="1.2" />
      <circle cx="1712" cy="150" r="70" fill="none" stroke="#c9a063" stroke-opacity="0.06" stroke-width="1" />
      <circle cx="1698" cy="138" r="30" fill="#c9a063" opacity="0.035" />

      <!-- 星尘 -->
      <g fill="#dfe8f5">
        <circle cx="240" cy="130" r="1.4" opacity="0.5" />
        <circle cx="430" cy="76" r="1" opacity="0.35" />
        <circle cx="700" cy="150" r="1.2" opacity="0.4" />
        <circle cx="980" cy="88" r="1" opacity="0.3" />
        <circle cx="1180" cy="164" r="1.3" opacity="0.42" />
        <circle cx="1700" cy="110" r="1.1" opacity="0.34" />
        <circle cx="1840" cy="220" r="1" opacity="0.28" />
        <circle cx="120" cy="260" r="1" opacity="0.26" />
      </g>

      <!-- 远山：长白山主峰轮廓 -->
      <path
        d="M0 760 L180 610 L286 682 L430 500 L520 588 L636 470 L744 596 L880 520 L980 640 L1090 556 L1230 660 L1360 566 L1500 690 L1650 596 L1780 700 L1920 620 L1920 1080 L0 1080 z"
        fill="url(#bdRidgeB)"
        opacity="0.85"
      />
      <!-- 主峰雪线（金色极淡） -->
      <path d="M430 500 L520 588 L636 470 L744 596" fill="none" stroke="url(#bdSnow)" stroke-width="2.4" opacity="0.5" />
      <path d="M636 470 L668 502 L700 480 L744 596" fill="#c9a063" opacity="0.05" />

      <!-- 近山 -->
      <path
        d="M0 900 L150 806 L300 880 L470 760 L610 856 L760 780 L920 880 L1080 800 L1240 890 L1400 806 L1560 900 L1720 830 L1920 906 L1920 1080 L0 1080 z"
        fill="url(#bdRidgeA)"
      />

      <!-- 云雾带 -->
      <rect x="0" y="640" width="1920" height="150" fill="url(#bdMist)" class="mist mist-a" />
      <rect x="0" y="820" width="1920" height="120" fill="url(#bdMist)" class="mist mist-b" />

      <!-- 松林剪影（延边地域意象，抽象） -->
      <g fill="#070d17" opacity="0.9">
        <path d="M96 1080 L96 968 L64 1010 L88 1010 L60 1046 L132 1046 L104 1010 L128 1010 z" />
        <path d="M168 1080 L168 990 L144 1024 L162 1024 L140 1052 L196 1052 L174 1024 L192 1024 z" />
        <path d="M1802 1080 L1802 960 L1768 1006 L1794 1006 L1762 1044 L1842 1044 L1810 1006 L1836 1006 z" />
        <path d="M1728 1080 L1728 994 L1704 1028 L1722 1028 L1700 1056 L1756 1056 L1734 1028 L1752 1028 z" />
      </g>
    </svg>

    <!-- L2 中景光晕 -->
    <div class="halo halo-core" />
    <div class="halo halo-warm" />
    <div class="halo halo-cool" />

    <!-- L3 前景微粒 -->
    <div class="motes">
      <span v-for="n in 22" :key="n" class="mote" :style="moteStyle(n)" />
    </div>
    <div class="vignette" />
  </div>
</template>

<script setup lang="ts">
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
  top: 34%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(58, 92, 148, 0.3) 0%, rgba(30, 48, 80, 0.14) 45%, transparent 72%);
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
  background: rgba(62, 120, 155, 0.11);
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
    radial-gradient(120% 88% at 50% 42%, transparent 42%, rgba(3, 6, 12, 0.55) 100%),
    linear-gradient(180deg, rgba(3, 6, 12, 0.5) 0%, transparent 22%, transparent 72%, rgba(3, 6, 12, 0.62) 100%);
}
</style>
