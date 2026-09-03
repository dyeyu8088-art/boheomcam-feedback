<template>
  <!--
    四张游戏海报（原创矢量 Key Art）
    渲染工具箱：Glow（模糊+叠加）/ Bloom（纯模糊光晕）/ Shadow（投影）/ DoF（远景虚化）/ Grain（绒面颗粒）
    所有场景内容都在 <g :transform="fit"> 里，宽/窄两种构图共用同一套坐标（宽版 420×300）。
  -->

  <!-- ══════════ 延边麻将：翡翠牌桌 · 黄铜吊灯 · 「中」牌主视觉 ══════════ -->
  <svg v-if="game === 'mahjong_yanbian'" :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="mjSky" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stop-color="#0f2a23" />
        <stop offset="0.5" stop-color="#091a16" />
        <stop offset="1" stop-color="#050f0c" />
      </linearGradient>
      <radialGradient id="mjFelt" cx="0.5" cy="0.36" r="0.7">
        <stop offset="0" stop-color="#2c7a5c" />
        <stop offset="0.38" stop-color="#1d5a43" />
        <stop offset="0.74" stop-color="#113a2c" />
        <stop offset="1" stop-color="#0a2519" />
      </radialGradient>
      <linearGradient id="mjCone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe9b8" stop-opacity="0.42" />
        <stop offset="0.55" stop-color="#ffd98f" stop-opacity="0.1" />
        <stop offset="1" stop-color="#ffd98f" stop-opacity="0" />
      </linearGradient>
      <radialGradient id="mjHeroGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ffe2a6" stop-opacity="0.75" />
        <stop offset="0.5" stop-color="#e2b364" stop-opacity="0.3" />
        <stop offset="1" stop-color="#c9a063" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="mjFace" cx="0.28" cy="0.2" r="1.05">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.45" stop-color="#f7f1e2" />
        <stop offset="0.85" stop-color="#e3d8bf" />
        <stop offset="1" stop-color="#cbbd9c" />
      </radialGradient>
      <linearGradient id="mjSide" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3f9a70" />
        <stop offset="1" stop-color="#1b4d34" />
      </linearGradient>
      <linearGradient id="mjBack" x1="0.1" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#4fb389" />
        <stop offset="0.6" stop-color="#2b7a56" />
        <stop offset="1" stop-color="#1a4f36" />
      </linearGradient>
      <linearGradient id="mjBrass" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#ffefc6" />
        <stop offset="0.4" stop-color="#d1aa62" />
        <stop offset="1" stop-color="#6e5222" />
      </linearGradient>
      <linearGradient id="mjRim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7d5f2c" />
        <stop offset="0.5" stop-color="#f3dfae" />
        <stop offset="1" stop-color="#7d5f2c" />
      </linearGradient>
      <linearGradient id="mjRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d94a3d" />
        <stop offset="1" stop-color="#9c231b" />
      </linearGradient>
      <linearGradient id="mjBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f5f96" />
        <stop offset="1" stop-color="#173659" />
      </linearGradient>
      <pattern id="mjScreen" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M0 23 H46 M23 0 V46" stroke="#c9a063" stroke-opacity="0.1" stroke-width="1" />
        <path d="M23 6 L40 23 L23 40 L6 23 z" fill="none" stroke="#c9a063" stroke-opacity="0.08" stroke-width="1" />
      </pattern>
      <filter id="mjGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="mjBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <filter id="mjSoftBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="mjShadow" x="-40%" y="-30%" width="180%" height="190%">
        <feDropShadow dx="0" dy="12" stdDeviation="7" flood-color="#02100a" flood-opacity="0.72" />
      </filter>
      <filter id="mjDof" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="1.3" />
      </filter>
      <filter id="mjGrain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0" />
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#mjSky)" />
    <g :transform="fit">
      <!-- 背景屏风暗纹 + 长白山剪影（虚化，拉开纵深） -->
      <rect x="-200" y="-140" width="820" height="420" fill="url(#mjScreen)" opacity="0.9" />
      <g filter="url(#mjDof)">
        <path d="M-40 158 L60 100 L110 132 L172 78 L214 118 L270 84 L326 136 L384 98 L460 138 L460 200 L-40 200 z" fill="#0b2620" opacity="0.8" />
        <path d="M172 78 L190 96 L206 86 L214 118" fill="#dfe8f0" opacity="0.12" />
        <g opacity="0.55">
          <rect x="16" y="14" width="12" height="220" rx="4" fill="#0d2620" stroke="#c9a063" stroke-opacity="0.32" stroke-width="1" />
          <rect x="392" y="14" width="12" height="220" rx="4" fill="#0d2620" stroke="#c9a063" stroke-opacity="0.32" stroke-width="1" />
          <path d="M28 40 h40 M28 88 h40 M28 136 h40 M352 40 h40 M352 88 h40 M352 136 h40" stroke="#c9a063" stroke-opacity="0.16" stroke-width="1" />
        </g>
      </g>

      <!-- 吊灯光锥（体积光） -->
      <path d="M196 78 L60 262 L360 262 L224 78 z" fill="url(#mjCone)" filter="url(#mjSoftBloom)" />
      <!-- 吊灯 -->
      <path d="M210 -30 V42" stroke="#c9a063" stroke-width="1.4" opacity="0.55" />
      <path d="M184 72 L198 42 h24 l14 30 z" fill="url(#mjBrass)" />
      <ellipse cx="210" cy="72" rx="26" ry="6.5" fill="#6e5222" />
      <ellipse cx="210" cy="71" rx="26" ry="6.5" fill="#f3dfae" opacity="0.55" />
      <ellipse cx="210" cy="75" rx="10" ry="4" fill="#fff4d6" filter="url(#mjGlow)" />
      <ellipse cx="210" cy="76" rx="30" ry="12" fill="#ffe9b8" opacity="0.35" filter="url(#mjBloom)" />

      <!-- 牌桌：绒面 + 颗粒 + 双金边 -->
      <g filter="url(#mjShadow)">
        <ellipse cx="210" cy="240" rx="216" ry="84" fill="#0b2b20" />
      </g>
      <ellipse cx="210" cy="238" rx="214" ry="82" fill="url(#mjFelt)" />
      <ellipse cx="210" cy="238" rx="214" ry="82" fill="#000" filter="url(#mjGrain)" />
      <ellipse cx="210" cy="238" rx="214" ry="82" fill="none" stroke="url(#mjRim)" stroke-width="3.2" />
      <ellipse cx="210" cy="238" rx="206" ry="76" fill="none" stroke="#f3dfae" stroke-opacity="0.22" stroke-width="1" />
      <ellipse cx="200" cy="208" rx="128" ry="30" fill="#ffffff" opacity="0.06" />

      <!-- 后排牌墙（虚化 + 2.5D） -->
      <g filter="url(#mjDof)" opacity="0.95">
        <ellipse cx="210" cy="190" rx="132" ry="12" fill="#04120c" opacity="0.5" />
        <g v-for="i in 7" :key="`w${i}`">
          <path :d="`M${86 + (i - 1) * 34} 150 l7 -9 h27 l-7 9 z`" fill="#5cc494" stroke="#0f3421" stroke-width="0.9" />
          <rect :x="86 + (i - 1) * 34" y="150" width="27" height="34" rx="4" fill="url(#mjBack)" stroke="#0f3421" stroke-width="1" />
          <rect :x="90 + (i - 1) * 34" y="155" width="19" height="24" rx="3" fill="none" stroke="#b6f0d2" stroke-opacity="0.38" stroke-width="1" />
          <path :d="`M${88.5 + (i - 1) * 34} 153 v28`" stroke="#d2ffe6" stroke-opacity="0.3" stroke-width="1.6" stroke-linecap="round" />
        </g>
      </g>

      <!-- 主视觉光晕 -->
      <ellipse cx="212" cy="210" rx="96" ry="70" fill="url(#mjHeroGlow)" filter="url(#mjBloom)" />

      <!-- 左侧：五萬 -->
      <g transform="translate(88 200) rotate(-14)" filter="url(#mjShadow)">
        <rect x="0" y="9" width="58" height="78" rx="8" fill="url(#mjSide)" />
        <image href="/assets/mahjong/Front.svg" x="0" y="0" width="58" height="77.3" />
        <image href="/assets/mahjong/Man5.svg" x="0" y="0" width="58" height="77.3" />
        <rect x="0.6" y="0.6" width="56.8" height="76" rx="7.5" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1" />
        <path d="M5 8 Q22 2 42 5" stroke="#fff" stroke-opacity="0.55" stroke-width="2.4" stroke-linecap="round" fill="none" />
      </g>
      <!-- 右侧：五筒 -->
      <g transform="translate(266 194) rotate(13)" filter="url(#mjShadow)">
        <rect x="0" y="9" width="58" height="78" rx="8" fill="url(#mjSide)" />
        <image href="/assets/mahjong/Front.svg" x="0" y="0" width="58" height="77.3" />
        <image href="/assets/mahjong/Pin5.svg" x="0" y="0" width="58" height="77.3" />
        <rect x="0.6" y="0.6" width="56.8" height="76" rx="7.5" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1" />
        <path d="M5 8 Q22 2 42 5" stroke="#fff" stroke-opacity="0.55" stroke-width="2.4" stroke-linecap="round" fill="none" />
      </g>

      <!-- 主视觉：中（更大、更立体、带鎏金轮廓光） -->
      <g transform="translate(166 146) rotate(-3)" filter="url(#mjShadow)">
        <rect x="0" y="12" width="88" height="117" rx="11" fill="url(#mjSide)" />
        <image href="/assets/mahjong/Front.svg" x="0" y="0" width="88" height="117.3" />
        <image href="/assets/mahjong/Chun.svg" x="0" y="0" width="88" height="117.3" />
        <rect x="1" y="1" width="86" height="115.3" rx="10.5" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1.2" />
        <rect x="0" y="0" width="88" height="117.3" rx="11" fill="none" stroke="#f3dfae" stroke-opacity="0.6" stroke-width="2.2" filter="url(#mjGlow)" />
        <path d="M6 10 Q30 2 60 6" stroke="#fff" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round" fill="none" />
      </g>

      <!-- 骰子 -->
      <g transform="translate(148 262) rotate(-14)" filter="url(#mjShadow)">
        <rect x="0" y="0" width="24" height="24" rx="6" fill="url(#mjFace)" stroke="#b5a784" stroke-width="1" />
        <circle cx="7" cy="7" r="2.6" fill="#c8362b" /><circle cx="17" cy="17" r="2.6" fill="#22303f" /><circle cx="12" cy="12" r="2.4" fill="#22303f" />
      </g>
      <!-- 筹码堆 -->
      <g transform="translate(276 264)">
        <ellipse cx="0" cy="8" rx="22" ry="8" fill="#02100a" opacity="0.5" filter="url(#mjSoftBloom)" />
        <ellipse cx="0" cy="4" rx="18" ry="7" fill="#8a6b3c" />
        <ellipse cx="0" cy="0" rx="18" ry="7" fill="#c9a063" />
        <ellipse cx="0" cy="-5" rx="18" ry="7" fill="#8a6b3c" />
        <ellipse cx="0" cy="-9" rx="18" ry="7" fill="#f3dfae" />
        <ellipse cx="0" cy="-9" rx="10" ry="3.8" fill="none" stroke="#8a6b3c" stroke-width="1.2" />
        <ellipse cx="-6" cy="-11" rx="5" ry="1.6" fill="#fff" opacity="0.6" />
      </g>

      <!-- 鎏金星芒与尘光 -->
      <g fill="#fff4d6" filter="url(#mjGlow)">
        <path d="M120 96 l2.2 -6.6 2.2 6.6 6.6 2.2 -6.6 2.2 -2.2 6.6 -2.2 -6.6 -6.6 -2.2 z" opacity="0.9" />
        <path d="M312 118 l1.8 -5.4 1.8 5.4 5.4 1.8 -5.4 1.8 -1.8 5.4 -1.8 -5.4 -5.4 -1.8 z" opacity="0.8" />
        <path d="M252 132 l1.6 -4.6 1.6 4.6 4.6 1.6 -4.6 1.6 -1.6 4.6 -1.6 -4.6 -4.6 -1.6 z" opacity="0.7" />
        <path d="M96 246 l1.8 -5 1.8 5 5 1.8 -5 1.8 -1.8 5 -1.8 -5 -5 -1.8 z" opacity="0.6" />
      </g>
      <g fill="#ffe9b8" opacity="0.5" filter="url(#mjSoftBloom)">
        <circle cx="72" cy="170" r="2.4" /><circle cx="340" cy="176" r="2" /><circle cx="300" cy="84" r="1.8" /><circle cx="132" cy="130" r="1.6" /><circle cx="368" cy="230" r="2.2" />
      </g>
    </g>
  </svg>

  <!-- ══════════ 红十：会所酒红绒桌 · 吊灯光锥 · 双红十 ══════════ -->
  <svg v-else-if="game === 'hongshi'" :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="hsBg" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stop-color="#2c1019" />
        <stop offset="0.5" stop-color="#170810" />
        <stop offset="1" stop-color="#0c0408" />
      </linearGradient>
      <radialGradient id="hsFelt" cx="0.5" cy="0.34" r="0.72">
        <stop offset="0" stop-color="#8e2f44" />
        <stop offset="0.36" stop-color="#6b2134" />
        <stop offset="0.72" stop-color="#3f111f" />
        <stop offset="1" stop-color="#240811" />
      </radialGradient>
      <linearGradient id="hsCone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe6b4" stop-opacity="0.4" />
        <stop offset="0.6" stop-color="#ffd48c" stop-opacity="0.08" />
        <stop offset="1" stop-color="#ffd48c" stop-opacity="0" />
      </linearGradient>
      <radialGradient id="hsHero" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ffd9a8" stop-opacity="0.6" />
        <stop offset="0.55" stop-color="#e2a06a" stop-opacity="0.2" />
        <stop offset="1" stop-color="#c9a063" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="hsCard" cx="0.3" cy="0.18" r="1.1">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.5" stop-color="#f8f4ea" />
        <stop offset="0.9" stop-color="#e6dfcf" />
        <stop offset="1" stop-color="#cfc5ad" />
      </radialGradient>
      <linearGradient id="hsBack" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stop-color="#34405e" />
        <stop offset="0.6" stop-color="#1c2438" />
        <stop offset="1" stop-color="#111726" />
      </linearGradient>
      <linearGradient id="hsPip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e8434f" />
        <stop offset="1" stop-color="#a51e2b" />
      </linearGradient>
      <linearGradient id="hsBrass" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#ffefc6" />
        <stop offset="0.4" stop-color="#d1aa62" />
        <stop offset="1" stop-color="#6e5222" />
      </linearGradient>
      <linearGradient id="hsRim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7d5f2c" />
        <stop offset="0.5" stop-color="#f3dfae" />
        <stop offset="1" stop-color="#7d5f2c" />
      </linearGradient>
      <pattern id="hsLattice" width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 7 L7 0 L14 7 L7 14 z" fill="none" stroke="#c9a063" stroke-opacity="0.45" stroke-width="0.8" />
      </pattern>
      <filter id="hsGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="hsBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <filter id="hsSoftBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="hsShadow" x="-40%" y="-30%" width="180%" height="190%">
        <feDropShadow dx="0" dy="12" stdDeviation="7" flood-color="#0a0206" flood-opacity="0.75" />
      </filter>
      <filter id="hsDof" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
      <filter id="hsGrain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="11" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.17 0" />
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#hsBg)" />
    <g :transform="fit">
      <!-- 会所拱券（虚化） -->
      <g filter="url(#hsDof)" opacity="0.7">
        <path d="M60 110 C60 26 360 26 360 110" fill="none" stroke="#c9a063" stroke-opacity="0.36" stroke-width="2" />
        <path d="M84 110 C84 46 336 46 336 110" fill="none" stroke="#c9a063" stroke-opacity="0.16" stroke-width="1" />
        <path d="M60 122 v-12 M360 122 v-12" stroke="#c9a063" stroke-opacity="0.34" stroke-width="2" />
        <path d="M120 34 h180 M140 24 h140" stroke="#c9a063" stroke-opacity="0.12" stroke-width="1" />
      </g>

      <!-- 吊灯 + 光锥 -->
      <path d="M194 62 L96 246 L324 246 L226 62 z" fill="url(#hsCone)" filter="url(#hsSoftBloom)" />
      <path d="M210 -40 V30" stroke="#c9a063" stroke-width="1.3" opacity="0.5" />
      <path d="M186 58 L200 30 h20 l14 28 z" fill="url(#hsBrass)" />
      <ellipse cx="210" cy="58" rx="24" ry="6" fill="#6e5222" />
      <ellipse cx="210" cy="57" rx="24" ry="6" fill="#f3dfae" opacity="0.5" />
      <ellipse cx="210" cy="61" rx="9" ry="3.6" fill="#fff4d6" filter="url(#hsGlow)" />
      <ellipse cx="210" cy="62" rx="28" ry="11" fill="#ffe6b4" opacity="0.35" filter="url(#hsBloom)" />

      <!-- 烟雾 -->
      <ellipse cx="140" cy="150" rx="120" ry="42" fill="#ffe6b4" opacity="0.06" filter="url(#hsBloom)" class="drift-a" />
      <ellipse cx="300" cy="120" rx="100" ry="36" fill="#ffe6b4" opacity="0.05" filter="url(#hsBloom)" class="drift-b" />

      <!-- 牌桌 -->
      <g filter="url(#hsShadow)">
        <ellipse cx="210" cy="246" rx="218" ry="80" fill="#2a0a14" />
      </g>
      <ellipse cx="210" cy="244" rx="216" ry="78" fill="url(#hsFelt)" />
      <ellipse cx="210" cy="244" rx="216" ry="78" fill="#000" filter="url(#hsGrain)" />
      <ellipse cx="210" cy="244" rx="216" ry="78" fill="none" stroke="url(#hsRim)" stroke-width="3.2" />
      <ellipse cx="210" cy="244" rx="208" ry="72" fill="none" stroke="#f3dfae" stroke-opacity="0.2" stroke-width="1" />

      <!-- 背牌扇（虚化） -->
      <g filter="url(#hsDof)">
        <g v-for="(a, i) in [-34, -17, 0, 17, 34]" :key="`bk${i}`" :transform="`translate(210 250) rotate(${a}) translate(-33 -100)`">
          <rect x="0" y="0" width="66" height="94" rx="8" fill="url(#hsBack)" stroke="#c9a063" stroke-width="1.4" />
          <rect x="7" y="7" width="52" height="80" rx="5" fill="url(#hsLattice)" stroke="#c9a063" stroke-opacity="0.5" stroke-width="0.8" />
        </g>
      </g>

      <!-- 主视觉光晕 -->
      <ellipse cx="212" cy="196" rx="104" ry="70" fill="url(#hsHero)" filter="url(#hsBloom)" />

      <!-- 红桃 10 / 方块 10（Vector Playing Cards，公共领域） -->
      <g transform="translate(140 132) rotate(-10)" filter="url(#hsShadow)">
        <rect x="0" y="0" width="84" height="122" rx="7" fill="#fdfbf5" />
        <image href="/assets/cards/10H.svg" x="0" y="0" width="84" height="122" />
        <rect x="0.6" y="0.6" width="82.8" height="120.8" rx="6.5" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1" />
        <rect x="0" y="0" width="84" height="122" rx="7" fill="none" stroke="#c3b9a1" stroke-width="0.8" />
        <path d="M6 10 Q26 3 48 6" stroke="#fff" stroke-opacity="0.5" stroke-width="2.4" stroke-linecap="round" fill="none" />
      </g>
      <g transform="translate(212 138) rotate(11)" filter="url(#hsShadow)">
        <rect x="0" y="0" width="84" height="122" rx="7" fill="#fdfbf5" />
        <image href="/assets/cards/10D.svg" x="0" y="0" width="84" height="122" />
        <rect x="0.6" y="0.6" width="82.8" height="120.8" rx="6.5" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1" />
        <rect x="0" y="0" width="84" height="122" rx="7" fill="none" stroke="#c3b9a1" stroke-width="0.8" />
        <path d="M6 10 Q26 3 48 6" stroke="#fff" stroke-opacity="0.5" stroke-width="2.4" stroke-linecap="round" fill="none" />
      </g>

      <!-- 筹码堆 ×2 -->
      <g transform="translate(334 250)">
        <ellipse cx="0" cy="10" rx="28" ry="10" fill="#0a0206" opacity="0.55" filter="url(#hsSoftBloom)" />
        <g v-for="(c, i) in ['#8a2233', '#b03248', '#8a2233', '#c9a063', '#f3dfae']" :key="`cp${i}`">
          <ellipse cx="0" :cy="4 - i * 5.5" rx="24" ry="9" :fill="c" />
          <ellipse cx="0" :cy="4 - i * 5.5" rx="24" ry="9" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="0.6" />
        </g>
        <ellipse cx="0" cy="-18" rx="13" ry="4.6" fill="none" stroke="#6e5426" stroke-width="1.2" />
        <ellipse cx="-8" cy="-20" rx="6" ry="1.8" fill="#fff" opacity="0.55" />
      </g>
      <g transform="translate(84 262)">
        <ellipse cx="0" cy="8" rx="22" ry="8" fill="#0a0206" opacity="0.5" filter="url(#hsSoftBloom)" />
        <g v-for="(c, i) in ['#1f2b46', '#2c3d63', '#c9a063']" :key="`cq${i}`">
          <ellipse cx="0" :cy="3 - i * 5" rx="18" ry="7" :fill="c" />
        </g>
        <ellipse cx="0" cy="-7" rx="9" ry="3.4" fill="none" stroke="#6e5426" stroke-width="1" />
      </g>

      <!-- 星芒与尘光 -->
      <g fill="#fff4d6" filter="url(#hsGlow)">
        <path d="M118 108 l2.6 -7.6 2.6 7.6 7.6 2.6 -7.6 2.6 -2.6 7.6 -2.6 -7.6 -7.6 -2.6 z" opacity="0.85" />
        <path d="M314 124 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 z" opacity="0.75" />
        <path d="M290 202 l1.5 -4.4 1.5 4.4 4.4 1.5 -4.4 1.5 -1.5 4.4 -1.5 -4.4 -4.4 -1.5 z" opacity="0.7" />
      </g>
      <g fill="#ffe6b4" opacity="0.45" filter="url(#hsSoftBloom)">
        <circle cx="70" cy="150" r="2.2" /><circle cx="352" cy="166" r="2" /><circle cx="248" cy="96" r="1.8" /><circle cx="160" cy="236" r="1.6" />
      </g>
    </g>
  </svg>

  <!-- ══════════ 捕鱼：深海 · 金龙鱼 · 金网 · 爆金 ══════════ -->
  <svg v-else-if="game === 'fishing'" :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="fsSea" x1="0" y1="0" x2="0.08" y2="1">
        <stop offset="0" stop-color="#1a6b8c" />
        <stop offset="0.3" stop-color="#0e4463" />
        <stop offset="0.65" stop-color="#082a40" />
        <stop offset="1" stop-color="#03111c" />
      </linearGradient>
      <radialGradient id="fsSun" cx="0.5" cy="0" r="0.7">
        <stop offset="0" stop-color="#bfeaf5" stop-opacity="0.5" />
        <stop offset="0.5" stop-color="#5fb8d6" stop-opacity="0.12" />
        <stop offset="1" stop-color="#5fb8d6" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="fsRay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#bfeaf5" stop-opacity="0.42" />
        <stop offset="1" stop-color="#bfeaf5" stop-opacity="0" />
      </linearGradient>
      <radialGradient id="fsBody" cx="0.36" cy="0.28" r="0.95">
        <stop offset="0" stop-color="#fff5cf" />
        <stop offset="0.3" stop-color="#f6d47e" />
        <stop offset="0.65" stop-color="#d9a745" />
        <stop offset="1" stop-color="#8a5e18" />
      </radialGradient>
      <linearGradient id="fsBelly" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7d5410" stop-opacity="0" />
        <stop offset="0.55" stop-color="#6b460c" stop-opacity="0.4" />
        <stop offset="1" stop-color="#3f2805" stop-opacity="0.7" />
      </linearGradient>
      <linearGradient id="fsFin" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#ffe9a8" stop-opacity="0.95" />
        <stop offset="0.6" stop-color="#e2b45a" stop-opacity="0.9" />
        <stop offset="1" stop-color="#9a6f22" stop-opacity="0.75" />
      </linearGradient>
      <linearGradient id="fsRim" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.5" stop-color="#ffefc0" stop-opacity="0.5" />
        <stop offset="1" stop-color="#ffefc0" stop-opacity="0" />
      </linearGradient>
      <radialGradient id="fsHero" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ffe2a0" stop-opacity="0.5" />
        <stop offset="0.6" stop-color="#e0b25c" stop-opacity="0.16" />
        <stop offset="1" stop-color="#c9a063" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="fsRope" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#fff2cf" />
        <stop offset="0.5" stop-color="#d9b877" />
        <stop offset="1" stop-color="#8a6b3c" />
      </linearGradient>
      <radialGradient id="fsCoin" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#fff3c8" />
        <stop offset="0.5" stop-color="#f0c96a" />
        <stop offset="1" stop-color="#a8792a" />
      </radialGradient>
      <pattern id="fsScale" width="16" height="12" patternUnits="userSpaceOnUse" patternTransform="translate(2 0)">
        <path d="M0 6 a8 8 0 0 1 16 0" fill="none" stroke="#8a6526" stroke-opacity="0.42" stroke-width="1.1" />
        <path d="M-8 12 a8 8 0 0 1 16 0 M8 12 a8 8 0 0 1 16 0" fill="none" stroke="#8a6526" stroke-opacity="0.42" stroke-width="1.1" />
      </pattern>
      <clipPath id="fsBodyClip">
        <path d="M-86 0 C-58 -50 -8 -66 40 -56 C82 -47 112 -26 124 0 C112 26 82 47 40 56 C-8 66 -58 50 -86 0 z" />
      </clipPath>
      <clipPath id="fsNetClip">
        <path d="M62 108 C118 80 178 102 190 158 C202 218 158 254 104 246 C56 238 38 162 62 108 z" />
      </clipPath>
      <filter id="fsGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="fsBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <filter id="fsSoftBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <filter id="fsShadow" x="-40%" y="-40%" width="180%" height="200%">
        <feDropShadow dx="0" dy="14" stdDeviation="9" flood-color="#010a12" flood-opacity="0.7" />
      </filter>
      <filter id="fsDof" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#fsSea)" />
    <g :transform="fit">
      <!-- 水面透光 + 焦散 -->
      <rect x="-200" y="-140" width="820" height="360" fill="url(#fsSun)" />
      <g stroke="#cdf1fa" stroke-width="1.6" fill="none" opacity="0.5" filter="url(#fsGlow)" class="ray-b">
        <path d="M-40 -6 q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke-opacity="0.35" />
        <path d="M-40 -30 q46 -13 92 0 t92 0 t92 0 t92 0 t92 0" stroke-opacity="0.2" />
      </g>
      <!-- 神光柱（体积光） -->
      <g filter="url(#fsSoftBloom)">
        <path d="M50 -80 L110 -80 L256 480 L118 480 z" fill="url(#fsRay)" class="ray-a" />
        <path d="M236 -80 L282 -80 L364 480 L258 480 z" fill="url(#fsRay)" opacity="0.7" class="ray-b" />
        <path d="M150 -80 L170 -80 L214 480 L170 480 z" fill="url(#fsRay)" opacity="0.4" class="ray-a" />
      </g>
      <!-- 悬浮微粒 -->
      <g fill="#cdf1fa" opacity="0.5">
        <circle v-for="(p, i) in motes" :key="`m${i}`" :cx="p[0]" :cy="p[1]" :r="p[2]" :opacity="p[3]" />
      </g>
      <!-- 远景鱼群（虚化） -->
      <g fill="#1d5a7a" opacity="0.9" filter="url(#fsDof)">
        <path d="M244 62 l18 -8 -4 8 4 8 z" /><path d="M270 78 l15 -7 -3 7 3 7 z" />
        <path d="M222 88 l13 -6 -3 6 3 6 z" /><path d="M292 56 l13 -6 -3 6 3 6 z" />
        <path d="M252 104 l11 -5 -2 5 2 5 z" /><path d="M196 66 l12 -5 -3 5 3 5 z" />
        <path d="M330 92 l14 -6 -3 6 3 6 z" /><path d="M356 70 l12 -5 -2 5 2 5 z" />
      </g>

      <!-- 主视觉光晕 -->
      <ellipse cx="196" cy="160" rx="170" ry="100" fill="url(#fsHero)" filter="url(#fsBloom)" />

      <!-- 金龙鱼 -->
      <g transform="translate(196 158)" filter="url(#fsShadow)">
        <!-- 尾鳍 -->
        <path d="M-84 0 C-108 -34 -126 -46 -150 -52 c8 22 12 36 12 52 c0 16 -4 30 -12 52 c24 -6 42 -18 66 -52 z" fill="url(#fsFin)" />
        <g stroke="#8a6526" stroke-opacity="0.45" stroke-width="1.2" fill="none">
          <path d="M-88 -6 C-108 -24 -124 -36 -142 -44" /><path d="M-88 6 C-108 24 -124 36 -142 44" />
          <path d="M-90 -1 C-110 -9 -124 -14 -138 -17" /><path d="M-90 1 C-110 9 -124 14 -138 17" />
        </g>
        <!-- 背鳍 -->
        <path d="M-32 -34 C-16 -70 18 -84 56 -78 C36 -60 26 -46 20 -32 z" fill="url(#fsFin)" />
        <g stroke="#8a6526" stroke-opacity="0.4" stroke-width="1.1" fill="none">
          <path d="M-18 -42 C-8 -58 6 -68 20 -72" /><path d="M2 -44 C12 -58 24 -68 40 -74" />
        </g>
        <!-- 腹鳍 -->
        <path d="M-6 36 C-10 64 -26 80 -50 88 c24 8 48 -2 66 -32 z" fill="url(#fsFin)" />
        <!-- 身体 -->
        <path d="M-86 0 C-58 -50 -8 -66 40 -56 C82 -47 112 -26 124 0 C112 26 82 47 40 56 C-8 66 -58 50 -86 0 z" fill="url(#fsBody)" />
        <path d="M-86 0 C-58 -12 -20 -16 24 -14 C70 -12 106 -8 124 0 C112 26 82 47 40 56 C-8 66 -58 50 -86 0 z" fill="url(#fsBelly)" />
        <!-- 鳞甲 -->
        <rect x="-90" y="-60" width="220" height="120" fill="url(#fsScale)" clip-path="url(#fsBodyClip)" />
        <!-- 胸鳍 -->
        <path d="M46 12 C60 36 58 56 44 70 C30 58 24 36 30 14 z" fill="url(#fsFin)" opacity="0.94" />
        <path d="M40 20 C50 36 50 50 44 62" fill="none" stroke="#8a6526" stroke-opacity="0.45" stroke-width="1.1" />
        <!-- 鳃盖 -->
        <path d="M86 -34 C96 -14 96 14 86 34" fill="none" stroke="#8a6526" stroke-opacity="0.6" stroke-width="1.8" />
        <path d="M94 -24 C102 -9 102 9 94 24" fill="none" stroke="#8a6526" stroke-opacity="0.32" stroke-width="1.1" />
        <!-- 眼 -->
        <circle cx="104" cy="-10" r="9" fill="#2a1c06" opacity="0.45" />
        <circle cx="104" cy="-10" r="8" fill="#fff" />
        <circle cx="106.6" cy="-9" r="4.6" fill="#1d232e" />
        <circle cx="104.4" cy="-11.6" r="1.7" fill="#fff" />
        <!-- 龙须 -->
        <path d="M124 4 q24 12 20 32" fill="none" stroke="#f2d492" stroke-width="2.6" stroke-linecap="round" opacity="0.9" />
        <path d="M120 12 q18 18 10 34" fill="none" stroke="#f2d492" stroke-width="2.1" stroke-linecap="round" opacity="0.75" />
        <!-- 背脊轮廓光 -->
        <path d="M-86 0 C-58 -50 -8 -66 40 -56 C82 -47 112 -26 124 0" fill="none" stroke="url(#fsRim)" stroke-width="3" stroke-linecap="round" filter="url(#fsGlow)" />
        <!-- 高光 -->
        <ellipse cx="6" cy="-32" rx="48" ry="11" fill="#fff" opacity="0.32" transform="rotate(-8 6 -32)" />
        <ellipse cx="66" cy="-22" rx="16" ry="5" fill="#fff" opacity="0.26" transform="rotate(-14 66 -22)" />
      </g>

      <!-- 金色渔网 -->
      <g class="net">
        <g clip-path="url(#fsNetClip)" fill="none" stroke="#f6dc98" stroke-opacity="0.5" stroke-width="1.4">
          <path v-for="i in 20" :key="`nma${i}`" :d="`M${-60 + (i - 1) * 20} 50 L${120 + (i - 1) * 20} 290`" />
          <path v-for="i in 20" :key="`nmb${i}`" :d="`M${-60 + (i - 1) * 20} 290 L${120 + (i - 1) * 20} 50`" />
        </g>
        <path d="M62 108 C118 80 178 102 190 158 C202 218 158 254 104 246 C56 238 38 162 62 108 z" fill="none" stroke="url(#fsRope)" stroke-width="3.6" stroke-linecap="round" filter="url(#fsGlow)" />
        <path d="M70 232 C50 260 40 288 34 316" fill="none" stroke="url(#fsRope)" stroke-width="2.8" stroke-linecap="round" opacity="0.8" />
        <path d="M104 246 C88 276 76 300 66 326" fill="none" stroke="url(#fsRope)" stroke-width="2.2" stroke-linecap="round" opacity="0.6" />
        <g fill="#fff2cf" filter="url(#fsGlow)">
          <circle cx="62" cy="108" r="3.6" /><circle cx="190" cy="158" r="4" /><circle cx="104" cy="246" r="3.4" />
        </g>
      </g>

      <!-- 爆金 -->
      <g v-for="c in hitCoins" :key="`hc${c.i}`" :transform="`translate(${c.x} ${c.y}) rotate(${c.r})`" filter="url(#fsGlow)">
        <ellipse cx="0" cy="2" :rx="c.s" :ry="c.s * 0.9" fill="#8a6b3c" />
        <ellipse cx="0" cy="0" :rx="c.s" :ry="c.s * 0.9" fill="url(#fsCoin)" />
        <ellipse cx="0" cy="0" :rx="c.s * 0.54" :ry="c.s * 0.48" fill="none" stroke="#a87c2e" stroke-width="1.1" />
      </g>
      <g fill="#fff6de" filter="url(#fsGlow)">
        <path d="M198 120 l4 -10 4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 z" opacity="0.85" />
        <path d="M84 176 l3 -7 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 z" opacity="0.65" />
        <path d="M262 236 l2.4 -6 2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 z" opacity="0.7" />
      </g>

      <!-- 海床与珊瑚（生物荧光） -->
      <path d="M-40 400 C60 358 140 386 222 358 C292 336 352 362 460 344 L460 480 L-40 480 z" fill="#05202f" opacity="0.94" />
      <g stroke="#0f4a62" stroke-linecap="round" fill="none">
        <path d="M322 372 q10 -40 -6 -62 M322 372 q-16 -26 -36 -36" stroke-width="7" />
        <path d="M262 366 q6 -26 -4 -44" stroke-width="5" opacity="0.8" />
        <path d="M296 370 q-4 -22 4 -34" stroke-width="4" opacity="0.6" />
      </g>
      <g fill="#7fe0ff" filter="url(#fsGlow)" opacity="0.8">
        <circle cx="316" cy="310" r="2" /><circle cx="286" cy="336" r="1.6" /><circle cx="258" cy="322" r="1.4" /><circle cx="300" cy="336" r="1.3" />
      </g>
      <!-- 气泡 -->
      <g fill="none" stroke="#dff6ff">
        <g class="bub-a"><circle cx="262" cy="212" r="6.5" stroke-width="1.7" opacity="0.8" /><path d="M259 209 a4 4 0 0 1 4 -2" stroke-width="1.4" opacity="0.9" /></g>
        <g class="bub-b"><circle cx="284" cy="186" r="4.4" stroke-width="1.4" opacity="0.65" /></g>
        <g class="bub-c"><circle cx="246" cy="166" r="3" stroke-width="1.2" opacity="0.55" /></g>
        <g class="bub-b"><circle cx="160" cy="132" r="3.8" stroke-width="1.3" opacity="0.6" /><path d="M158 130 a2.4 2.4 0 0 1 2.4 -1.2" stroke-width="1.1" opacity="0.9" /></g>
        <g class="bub-c"><circle cx="182" cy="108" r="2.4" stroke-width="1.1" opacity="0.45" /></g>
      </g>
    </g>
  </svg>

  <!-- ══════════ 黄金水果：黑金机柜 · 鎏金铭牌 · 樱桃/7/BAR ══════════ -->
  <svg v-else :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="slBg" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#2b1a40" />
        <stop offset="0.5" stop-color="#150e25" />
        <stop offset="1" stop-color="#0a0612" />
      </linearGradient>
      <radialGradient id="slHalo" cx="0.5" cy="0.44" r="0.6">
        <stop offset="0" stop-color="#f6c66a" stop-opacity="0.4" />
        <stop offset="0.5" stop-color="#d59a3e" stop-opacity="0.12" />
        <stop offset="1" stop-color="#d59a3e" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="slGoldV" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff2c8" />
        <stop offset="0.22" stop-color="#e6bf6f" />
        <stop offset="0.5" stop-color="#a97b32" />
        <stop offset="0.78" stop-color="#d9b463" />
        <stop offset="1" stop-color="#6b4d1c" />
      </linearGradient>
      <linearGradient id="slGoldD" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#ffefc4" />
        <stop offset="0.45" stop-color="#cfa354" />
        <stop offset="1" stop-color="#6e4f1c" />
      </linearGradient>
      <linearGradient id="slWin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#05060c" />
        <stop offset="0.5" stop-color="#1a2138" />
        <stop offset="1" stop-color="#05060c" />
      </linearGradient>
      <linearGradient id="slGlass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.16" />
        <stop offset="0.3" stop-color="#fff" stop-opacity="0.03" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="slSeven" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#ff6d63" />
        <stop offset="0.5" stop-color="#d9333a" />
        <stop offset="1" stop-color="#8f171e" />
      </linearGradient>
      <radialGradient id="slCherry" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#ff8a86" />
        <stop offset="0.45" stop-color="#d9333a" />
        <stop offset="1" stop-color="#7d1219" />
      </radialGradient>
      <linearGradient id="slBar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe89a" />
        <stop offset="0.5" stop-color="#e2b84a" />
        <stop offset="1" stop-color="#9c7420" />
      </linearGradient>
      <radialGradient id="slBall" cx="0.32" cy="0.28" r="0.85">
        <stop offset="0" stop-color="#ff9a94" />
        <stop offset="0.5" stop-color="#d9333a" />
        <stop offset="1" stop-color="#6e0f15" />
      </radialGradient>
      <radialGradient id="slCoin" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#fff3c8" />
        <stop offset="0.5" stop-color="#f0c96a" />
        <stop offset="1" stop-color="#a8792a" />
      </radialGradient>
      <filter id="slGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="slBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
      <filter id="slSoftBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id="slShadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#05030a" flood-opacity="0.75" />
      </filter>
      <filter id="slSymShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.6" />
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#slBg)" />
    <g :transform="fit">
      <rect x="-200" y="-160" width="820" height="700" fill="url(#slHalo)" />
      <!-- 放射流光 -->
      <g opacity="0.2" class="spin-slow" style="transform-origin: 210px 150px" filter="url(#slSoftBloom)">
        <path v-for="i in 14" :key="`r${i}`" :d="rayPath(i)" fill="#f6c66a" />
      </g>

      <!-- 机柜投影 -->
      <g filter="url(#slShadow)">
        <rect x="40" y="70" width="340" height="180" rx="28" fill="#1a1024" />
      </g>
      <!-- 机柜：三层鎏金斜面 -->
      <rect x="40" y="70" width="340" height="180" rx="28" fill="url(#slGoldV)" />
      <rect x="46" y="76" width="328" height="168" rx="24" fill="url(#slGoldD)" />
      <rect x="46" y="76" width="328" height="168" rx="24" fill="none" stroke="#fff6d6" stroke-opacity="0.55" stroke-width="1" />
      <!-- 窗口 -->
      <rect x="58" y="88" width="304" height="144" rx="18" fill="#05060c" />
      <rect x="58" y="88" width="304" height="144" rx="18" fill="url(#slWin)" />
      <rect x="58" y="88" width="304" height="144" rx="18" fill="none" stroke="#3a4358" stroke-width="1.4" />
      <!-- 筒身明暗 -->
      <rect x="58" y="88" width="304" height="30" rx="12" fill="#03040a" opacity="0.6" />
      <rect x="58" y="202" width="304" height="30" rx="12" fill="#03040a" opacity="0.6" />
      <!-- 列分隔 -->
      <path d="M159 88 v144 M261 88 v144" stroke="#3a4358" stroke-width="2" />
      <path d="M160.5 88 v144 M262.5 88 v144" stroke="#fff" stroke-opacity="0.06" stroke-width="1" />
      <!-- 中线（赔付线）发光 -->
      <path d="M62 160 H358" stroke="#ffd98f" stroke-opacity="0.25" stroke-width="2" filter="url(#slGlow)" />

      <!-- 符号：樱桃 / 7 / BAR -->
      <g transform="translate(108 158)" filter="url(#slSymShadow)">
        <path d="M-2 -38 C2 -26 6 -16 10 -6 M-2 -38 C-12 -26 -18 -15 -18 -3" stroke="#4c7a3a" stroke-width="4.2" fill="none" stroke-linecap="round" />
        <path d="M-2 -38 c10 -7 20 -7 28 -2 c-10 3 -18 3 -28 2 z" fill="#5b9146" />
        <circle cx="-18" cy="12" r="14" fill="url(#slCherry)" />
        <circle cx="10" cy="8" r="16" fill="url(#slCherry)" />
        <ellipse cx="4" cy="1" rx="5" ry="3" fill="#fff" opacity="0.55" transform="rotate(-30 4 1)" />
        <ellipse cx="-23" cy="6" rx="4" ry="2.4" fill="#fff" opacity="0.5" transform="rotate(-30 -23 6)" />
      </g>
      <g transform="translate(210 158)" filter="url(#slSymShadow)">
        <path d="M-26 -38 h54 l-20 78 h-20 l17 -54 h-31 z" fill="#5c0d12" transform="translate(4 5)" />
        <path d="M-26 -38 h54 l-20 78 h-20 l17 -54 h-31 z" fill="url(#slSeven)" />
        <path d="M-26 -38 h54 l-4 9 h-50 z" fill="#fff" opacity="0.35" />
        <path d="M-22 -34 h46" stroke="#fff" stroke-opacity="0.6" stroke-width="1.6" stroke-linecap="round" />
      </g>
      <g transform="translate(312 158)" filter="url(#slSymShadow)">
        <g v-for="k in 3" :key="`bar${k}`" :transform="`translate(0 ${-30 + (k - 1) * 24})`">
          <rect x="-36" y="0" width="72" height="20" rx="5" fill="url(#slBar)" stroke="#7a5716" stroke-width="1.4" />
          <rect x="-34" y="1.5" width="68" height="7" rx="3.5" fill="#fff" opacity="0.28" />
        </g>
        <text x="0" y="8" text-anchor="middle" font-size="15" font-weight="900" fill="#5c3f10" font-family="system-ui,sans-serif" letter-spacing="1">BAR</text>
      </g>
      <!-- 玻璃反光 -->
      <rect x="58" y="88" width="304" height="144" rx="18" fill="url(#slGlass)" />
      <path d="M70 92 L150 92 L98 228 L64 228 z" fill="#fff" opacity="0.04" />

      <!-- 铭牌灯带 -->
      <rect x="130" y="46" width="160" height="22" rx="11" fill="url(#slGoldV)" />
      <rect x="134" y="50" width="152" height="14" rx="7" fill="#1a1024" />
      <g filter="url(#slGlow)">
        <circle v-for="k in 5" :key="`lamp${k}`" :cx="150 + (k - 1) * 30" cy="57" r="4" :fill="k % 2 ? '#fff3d0' : '#ffd88a'" />
      </g>
      <!-- 角铆钉 -->
      <g fill="url(#slGoldD)" stroke="#6e4f1c" stroke-width="1">
        <circle cx="54" cy="84" r="4.5" /><circle cx="366" cy="84" r="4.5" /><circle cx="54" cy="236" r="4.5" /><circle cx="366" cy="236" r="4.5" />
      </g>
      <!-- 拉杆 -->
      <rect x="380" y="118" width="12" height="72" rx="6" fill="url(#slGoldD)" stroke="#6e4f1c" stroke-width="1" />
      <circle cx="386" cy="110" r="15" fill="url(#slBall)" />
      <ellipse cx="381" cy="104" rx="5" ry="3" fill="#fff" opacity="0.55" transform="rotate(-30 381 104)" />
      <!-- 币槽与币粒 -->
      <rect x="120" y="254" width="180" height="16" rx="8" fill="#120c1c" stroke="#8a6b3c" stroke-width="1.4" />
      <g v-for="c in coins" :key="`c${c.i}`" :transform="`translate(${c.x} ${c.y}) rotate(${c.r})`" filter="url(#slGlow)">
        <ellipse cx="0" cy="2.4" rx="12" ry="11" fill="#8a6b3c" />
        <ellipse cx="0" cy="0" rx="12" ry="11" fill="url(#slCoin)" />
        <ellipse cx="0" cy="0" rx="6.4" ry="5.8" fill="none" stroke="#a87c2e" stroke-width="1.2" />
      </g>
      <!-- 星芒 -->
      <g fill="#fff6dc" filter="url(#slGlow)">
        <path d="M64 262 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z" opacity="0.9" />
        <path d="M360 44 l2.6 5 5 2.6 -5 2.6 -2.6 5 -2.6 -5 -5 -2.6 5 -2.6 z" opacity="0.8" />
        <path d="M46 56 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z" opacity="0.6" />
        <path d="M398 232 l2.2 4.4 4.4 2.2 -4.4 2.2 -2.2 4.4 -2.2 -4.4 -4.4 -2.2 4.4 -2.2 z" opacity="0.7" />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ game: string; layout?: 'wide' | 'tall' }>(), { layout: 'wide' });

const vb = computed(() => (props.layout === 'tall' ? '0 0 300 430' : '0 0 420 300'));

/**
 * 窄卡安全区：卡片宽高比（≈0.57–0.63）窄于窗口比（300/430≈0.70），
 * slice 会横向裁掉约 25–30 个单位，因此每个场景单独定标定位，
 * 保证主体（鱼尾/拉杆/筹码）完整落在 x∈[30,270]、y∈[70,340] 内。
 * anchor = 宽版坐标系中希望落在窄卡 (150, 182) 的那个点。
 */
const TALL: Record<string, { s: number; ax: number; ay: number }> = {
  mahjong_yanbian: { s: 0.92, ax: 205, ay: 186 },
  hongshi: { s: 0.84, ax: 211, ay: 200 },
  fishing: { s: 0.8, ax: 185, ay: 168 },
  slot_fruit: { s: 0.68, ax: 214, ay: 158 },
};

const fit = computed(() => {
  if (props.layout !== 'tall') {
    // 宽卡：场景整体上移，主体避开底部文字区（上移过多会把吊灯裁掉）
    return 'translate(0 -26)';
  }
  const c = TALL[props.game] ?? { s: 0.82, ax: 210, ay: 168 };
  const tx = 150 - c.ax * c.s;
  const ty = 182 - c.ay * c.s;
  return `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${c.s})`;
});

/** 捕鱼击杀掉落的金币（全部落在窄卡安全区 x∈[30,270] 内） */
const hitCoins = [
  { i: 1, x: 214, y: 246, r: -18, s: 11 },
  { i: 2, x: 244, y: 214, r: 24, s: 8.5 },
  { i: 3, x: 186, y: 272, r: 12, s: 9 },
  { i: 4, x: 258, y: 262, r: -30, s: 7 },
  { i: 5, x: 150, y: 286, r: 8, s: 7.5 },
  { i: 6, x: 226, y: 288, r: 34, s: 6 },
];

/** 水中悬浮微粒（确定性伪随机，避免每次渲染抖动） */
const motes: [number, number, number, number][] = Array.from({ length: 34 }, (_, i) => {
  const x = ((i * 197) % 400) + 10;
  const y = ((i * 421) % 300) - 20;
  const r = 0.7 + ((i * 13) % 5) * 0.32;
  const o = 0.25 + ((i * 7) % 10) / 20;
  return [x, y, r, o];
});

const coins = [
  { i: 1, x: 90, y: 262, r: -14 },
  { i: 2, x: 124, y: 274, r: 22 },
  { i: 3, x: 158, y: 264, r: 8 },
  { i: 4, x: 262, y: 270, r: -20 },
  { i: 5, x: 296, y: 260, r: 16 },
  { i: 6, x: 330, y: 274, r: -6 },
];

function rayPath(i: number): string {
  const a0 = (Math.PI * 2 * (i - 1)) / 14;
  const a1 = a0 + 0.13;
  const R = 420;
  const x0 = 210 + Math.cos(a0) * R;
  const y0 = 150 + Math.sin(a0) * R;
  const x1 = 210 + Math.cos(a1) * R;
  const y1 = 150 + Math.sin(a1) * R;
  return `M210 150 L${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)} z`;
}
</script>

<style scoped>
.poster {
  width: 100%;
  height: 100%;
  display: block;
}
/* 极克制的场景微动效 */
.drift-a {
  animation: drift 22s ease-in-out infinite alternate;
}
.drift-b {
  animation: drift 28s ease-in-out infinite alternate-reverse;
}
@keyframes drift {
  0% {
    transform: translateX(-14px);
    opacity: 0.7;
  }
  100% {
    transform: translateX(14px);
    opacity: 1;
  }
}
.ray-a {
  animation: sway 14s ease-in-out infinite alternate;
}
.ray-b {
  animation: sway 18s ease-in-out infinite alternate-reverse;
}
@keyframes sway {
  0% {
    transform: translateX(-10px);
  }
  100% {
    transform: translateX(10px);
  }
}
.bub-a {
  animation: bubble 6s ease-in infinite;
}
.bub-b {
  animation: bubble 7.5s ease-in infinite 1.2s;
}
.bub-c {
  animation: bubble 9s ease-in infinite 2.4s;
}
@keyframes bubble {
  0% {
    transform: translateY(20px);
    opacity: 0;
  }
  20% {
    opacity: 0.7;
  }
  100% {
    transform: translateY(-120px);
    opacity: 0;
  }
}
.spin-slow {
  animation: spin 60s linear infinite;
}
</style>
