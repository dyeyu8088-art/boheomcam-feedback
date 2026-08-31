<template>
  <!-- ══════════ 延边麻将：翡翠牌桌 · 屏风 · 中牌主视觉 ══════════ -->
  <svg v-if="game === 'mahjong_yanbian'" :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="mjSky" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#132a24" />
        <stop offset="0.55" stop-color="#0c1c1a" />
        <stop offset="1" stop-color="#08120f" />
      </linearGradient>
      <radialGradient id="mjLamp" cx="0.5" cy="0.18" r="0.62">
        <stop offset="0" stop-color="#e8cf9a" stop-opacity="0.34" />
        <stop offset="0.5" stop-color="#c9a063" stop-opacity="0.1" />
        <stop offset="1" stop-color="#c9a063" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="mjFelt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1d5442" />
        <stop offset="1" stop-color="#0e2f26" />
      </linearGradient>
      <linearGradient id="mjTileFace" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#fffdf6" />
        <stop offset="0.7" stop-color="#f0e7d3" />
        <stop offset="1" stop-color="#d3c6a6" />
      </linearGradient>
      <linearGradient id="mjTileSide" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f7f5c" />
        <stop offset="1" stop-color="#17452f" />
      </linearGradient>
      <linearGradient id="mjTileBack" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#3d9a71" />
        <stop offset="1" stop-color="#1a5138" />
      </linearGradient>
      <linearGradient id="mjLamp" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#f0dcae" />
        <stop offset="0.45" stop-color="#b8934f" />
        <stop offset="1" stop-color="#6b4f22" />
      </linearGradient>
      <pattern id="mjScreen" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M0 23 H46 M23 0 V46" stroke="#c9a063" stroke-opacity="0.09" stroke-width="1" />
        <path d="M23 6 L40 23 L23 40 L6 23 z" fill="none" stroke="#c9a063" stroke-opacity="0.075" stroke-width="1" />
      </pattern>
    </defs>

    <rect width="100%" height="100%" fill="url(#mjSky)" />
    <g :transform="fit">
    <rect x="-200" y="-120" width="820" height="380" fill="url(#mjScreen)" opacity="0.9" />
    <!-- 长白山极淡轮廓（地域气质） -->
    <path d="M0 150 L70 104 L112 134 L170 88 L214 124 L268 92 L322 138 L378 104 L420 132 L420 182 L0 182 z" fill="#0d2320" opacity="0.65" />
    <rect x="-200" y="-160" width="820" height="700" fill="url(#mjLamp)" />
    <!-- 东方屏风立柱（左右） -->
    <g opacity="0.5">
      <rect x="18" y="20" width="10" height="210" rx="3" fill="#0f2a24" stroke="#c9a063" stroke-opacity="0.28" stroke-width="1" />
      <rect x="392" y="20" width="10" height="210" rx="3" fill="#0f2a24" stroke="#c9a063" stroke-opacity="0.28" stroke-width="1" />
      <path d="M28 44 h44 M28 92 h44 M28 140 h44 M348 44 h44 M348 92 h44 M348 140 h44" stroke="#c9a063" stroke-opacity="0.14" stroke-width="1" />
      <path d="M50 44 v96 M370 44 v96" stroke="#c9a063" stroke-opacity="0.12" stroke-width="1" />
    </g>
    <!-- 吊灯（黄铜灯罩 + 暖光落照） -->
    <path d="M210 0 V44" stroke="#c9a063" stroke-width="1.4" opacity="0.5" />
    <path d="M188 70 L200 44 h20 l12 26 z" fill="url(#mjLamp)" />
    <ellipse cx="210" cy="70" rx="22" ry="5.5" fill="#7d5f2c" />
    <ellipse cx="210" cy="69" rx="22" ry="5.5" fill="#e8cf9a" opacity="0.5" />
    <ellipse cx="210" cy="72" rx="9" ry="3.4" fill="#ffe6b4" opacity="0.8" />
    <ellipse cx="210" cy="82" rx="52" ry="14" fill="#e8cf9a" opacity="0.11" />

    <!-- 牌桌 -->
    <ellipse cx="210" cy="238" rx="212" ry="80" fill="url(#mjFelt)" />
    <ellipse cx="210" cy="238" rx="212" ry="80" fill="none" stroke="#c9a063" stroke-opacity="0.3" stroke-width="2" />
    <ellipse cx="210" cy="232" rx="176" ry="62" fill="none" stroke="#c9a063" stroke-opacity="0.13" stroke-width="1" />
    <ellipse cx="196" cy="212" rx="120" ry="30" fill="#ffffff" opacity="0.05" />

    <!-- 后排牌墙（2.5D：顶面斜切 + 正面 + 桌面投影） -->
    <g opacity="0.95">
      <ellipse cx="210" cy="188" rx="128" ry="11" fill="#04120c" opacity="0.42" />
      <g v-for="i in 7" :key="`w${i}`">
        <path :d="`M${86 + (i - 1) * 34} 150 l7 -9 h27 l-7 9 z`" fill="#4aa87d" stroke="#0f3421" stroke-width="0.9" />
        <rect :x="86 + (i - 1) * 34" y="150" width="27" height="34" rx="4" fill="url(#mjTileBack)" stroke="#0f3421" stroke-width="1" />
        <rect :x="90 + (i - 1) * 34" y="155" width="19" height="24" rx="3" fill="none" stroke="#8fd4b2" stroke-opacity="0.35" stroke-width="1" />
        <path :d="`M${88.5 + (i - 1) * 34} 153 v28`" stroke="#a7e6c4" stroke-opacity="0.26" stroke-width="1.6" stroke-linecap="round" />
      </g>
    </g>

    <!-- 主视觉：中牌（立体） -->
    <g transform="translate(186 168)">
      <rect x="0" y="10" width="70" height="96" rx="11" fill="url(#mjTileSide)" />
      <rect x="0" y="0" width="70" height="96" rx="11" fill="url(#mjTileFace)" />
      <rect x="0" y="0" width="70" height="96" rx="11" fill="none" stroke="#bcae8c" stroke-width="1.2" />
      <text x="35" y="66" text-anchor="middle" font-size="52" font-weight="800" fill="#b8352c" font-family="serif">中</text>
      <ellipse cx="18" cy="14" rx="14" ry="6" fill="#fff" opacity="0.55" transform="rotate(-22 18 14)" />
    </g>

    <!-- 左侧：万/条 -->
    <g transform="translate(106 194) rotate(-11)">
      <rect x="0" y="8" width="54" height="74" rx="9" fill="url(#mjTileSide)" />
      <rect x="0" y="0" width="54" height="74" rx="9" fill="url(#mjTileFace)" stroke="#bcae8c" stroke-width="1.1" />
      <text x="27" y="34" text-anchor="middle" font-size="24" font-weight="800" fill="#1c3f66" font-family="serif">五</text>
      <text x="27" y="60" text-anchor="middle" font-size="22" font-weight="800" fill="#b8352c" font-family="serif">萬</text>
    </g>
    <!-- 右侧：筒 -->
    <g transform="translate(264 198) rotate(12)">
      <rect x="0" y="8" width="54" height="74" rx="9" fill="url(#mjTileSide)" />
      <rect x="0" y="0" width="54" height="74" rx="9" fill="url(#mjTileFace)" stroke="#bcae8c" stroke-width="1.1" />
      <g fill="#1c3f66">
        <circle cx="18" cy="24" r="6.5" /><circle cx="36" cy="24" r="6.5" />
        <circle cx="18" cy="42" r="6.5" /><circle cx="36" cy="42" r="6.5" />
        <circle cx="27" cy="60" r="6.5" />
      </g>
    </g>

    <!-- 骰子与筹码点缀 -->
    <g transform="translate(150 252)">
      <rect x="0" y="0" width="22" height="22" rx="5" fill="#f4efe2" stroke="#b7ab90" stroke-width="1" />
      <circle cx="7" cy="7" r="2.4" fill="#b8352c" /><circle cx="15" cy="15" r="2.4" fill="#22303f" />
    </g>
    <g transform="translate(258 256)">
      <ellipse cx="0" cy="0" rx="16" ry="6" fill="#c9a063" opacity="0.85" />
      <ellipse cx="0" cy="-4" rx="16" ry="6" fill="#e8cf9a" />
      <ellipse cx="0" cy="-4" rx="9" ry="3.4" fill="none" stroke="#8a6b3c" stroke-width="1" />
    </g>
    <!-- 光斑 -->
    <circle cx="352" cy="80" r="2" fill="#e6cfa3" opacity="0.7" />
    <circle cx="72" cy="62" r="1.6" fill="#e6cfa3" opacity="0.5" />
    </g>
  </svg>

  <!-- ══════════ 红十：酒红牌桌 · 双红十 · 烟雾 ══════════ -->
  <svg v-else-if="game === 'hongshi'" :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="hsBg" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stop-color="#2a1119" />
        <stop offset="0.5" stop-color="#180a11" />
        <stop offset="1" stop-color="#0d060a" />
      </linearGradient>
      <radialGradient id="hsSpot" cx="0.5" cy="0.3" r="0.6">
        <stop offset="0" stop-color="#e8cf9a" stop-opacity="0.22" />
        <stop offset="1" stop-color="#e8cf9a" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="hsFelt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5c1f2c" />
        <stop offset="1" stop-color="#2c0d15" />
      </linearGradient>
      <linearGradient id="hsCardFace" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.75" stop-color="#f3efe4" />
        <stop offset="1" stop-color="#ded7c6" />
      </linearGradient>
      <linearGradient id="hsCardBack" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#2e3a56" />
        <stop offset="1" stop-color="#141a2b" />
      </linearGradient>
      <linearGradient id="hsSmoke" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#e8cf9a" stop-opacity="0.14" />
        <stop offset="1" stop-color="#e8cf9a" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="hsBeam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe6b4" stop-opacity="0.16" />
        <stop offset="1" stop-color="#ffe6b4" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="hsLamp" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#f0dcae" />
        <stop offset="0.45" stop-color="#b8934f" />
        <stop offset="1" stop-color="#6b4f22" />
      </linearGradient>
    </defs>

    <rect width="100%" height="100%" fill="url(#hsBg)" />
    <g :transform="fit">
    <rect x="-200" y="-160" width="820" height="700" fill="url(#hsSpot)" />

    <!-- 会所拱券与垂帘（填充上部空场，营造私人牌室纵深） -->
    <g opacity="0.55">
      <path d="M72 98 C72 24 348 24 348 98" fill="none" stroke="#c9a063" stroke-opacity="0.3" stroke-width="1.6" />
      <path d="M94 98 C94 42 326 42 326 98" fill="none" stroke="#c9a063" stroke-opacity="0.14" stroke-width="1" />
      <path d="M72 106 v-10 M348 106 v-10" stroke="#c9a063" stroke-opacity="0.28" stroke-width="1.6" />
      <path
        d="M110 34 h200 M132 24 h156"
        stroke="#c9a063"
        stroke-opacity="0.1"
        stroke-width="1"
      />
    </g>

    <!-- 铜制吊灯 + 光锥（黄铜灯罩 / 暖光灯胆 / 柔和落光） -->
    <path d="M210 -70 V14" stroke="#c9a063" stroke-width="1.3" opacity="0.4" />
    <path d="M188 40 L200 14 h20 l12 26 z" fill="url(#hsLamp)" />
    <ellipse cx="210" cy="40" rx="22" ry="5.5" fill="#7d5f2c" />
    <ellipse cx="210" cy="39" rx="22" ry="5.5" fill="#e8cf9a" opacity="0.55" />
    <ellipse cx="210" cy="42" rx="9" ry="3.4" fill="#ffe6b4" opacity="0.85" />
    <ellipse cx="210" cy="48" rx="26" ry="10" fill="#ffe6b4" opacity="0.16" />
    <path d="M192 46 L136 216 h148 L228 46 z" fill="url(#hsBeam)" />

    <!-- 烟雾 -->
    <ellipse cx="150" cy="150" rx="130" ry="60" fill="url(#hsSmoke)" class="drift-a" />
    <ellipse cx="290" cy="120" rx="110" ry="48" fill="url(#hsSmoke)" class="drift-b" />

    <!-- 牌桌 -->
    <ellipse cx="210" cy="246" rx="214" ry="76" fill="url(#hsFelt)" />
    <ellipse cx="210" cy="246" rx="214" ry="76" fill="none" stroke="#c9a063" stroke-opacity="0.32" stroke-width="2" />
    <ellipse cx="210" cy="240" rx="178" ry="58" fill="none" stroke="#c9a063" stroke-opacity="0.12" stroke-width="1" />

    <!-- 扇形背牌 -->
    <g transform="translate(108 212) rotate(-26)">
      <rect x="0" y="0" width="66" height="94" rx="9" fill="url(#hsCardBack)" stroke="#c9a063" stroke-width="1.3" />
      <path d="M8 10 L58 84 M58 10 L8 84 M33 6 v82" stroke="#c9a063" stroke-opacity="0.34" stroke-width="0.9" />
    </g>
    <g transform="translate(258 214) rotate(24)">
      <rect x="0" y="0" width="66" height="94" rx="9" fill="url(#hsCardBack)" stroke="#c9a063" stroke-width="1.3" />
      <path d="M8 10 L58 84 M58 10 L8 84 M33 6 v82" stroke="#c9a063" stroke-opacity="0.34" stroke-width="0.9" />
    </g>

    <!-- 主视觉：红桃10 + 方块10 -->
    <g transform="translate(150 158) rotate(-8)">
      <rect x="4" y="8" width="72" height="102" rx="9" fill="#000" opacity="0.4" />
      <rect x="0" y="0" width="72" height="102" rx="9" fill="url(#hsCardFace)" stroke="#c3baa4" stroke-width="1.2" />
      <text x="10" y="22" font-size="17" font-weight="800" fill="#c22b3a" font-family="system-ui">10</text>
      <text x="62" y="94" font-size="17" font-weight="800" fill="#c22b3a" font-family="system-ui" text-anchor="end" transform="rotate(180 62 88)">10</text>
      <path d="M36 74 c-15 -12 -21 -21 -21 -29 a10.5 10.5 0 0 1 21 -3 a10.5 10.5 0 0 1 21 3 c0 8 -6 17 -21 29 z" fill="#c22b3a" />
    </g>
    <g transform="translate(212 164) rotate(9)">
      <rect x="4" y="8" width="72" height="102" rx="9" fill="#000" opacity="0.4" />
      <rect x="0" y="0" width="72" height="102" rx="9" fill="url(#hsCardFace)" stroke="#c3baa4" stroke-width="1.2" />
      <text x="10" y="22" font-size="17" font-weight="800" fill="#c22b3a" font-family="system-ui">10</text>
      <path d="M36 26 L58 56 L36 86 L14 56 z" fill="#c22b3a" />
    </g>

    <!-- 筹码堆 -->
    <g transform="translate(330 250)">
      <ellipse cx="0" cy="6" rx="26" ry="9" fill="#000" opacity="0.35" />
      <ellipse cx="0" cy="0" rx="24" ry="9" fill="#8a2233" />
      <ellipse cx="0" cy="-7" rx="24" ry="9" fill="#b03248" />
      <ellipse cx="0" cy="-14" rx="24" ry="9" fill="#c9a063" />
      <ellipse cx="0" cy="-14" rx="13" ry="4.6" fill="none" stroke="#6e5426" stroke-width="1.2" />
    </g>
    <circle cx="70" cy="66" r="1.8" fill="#e6cfa3" opacity="0.6" />
    <circle cx="360" cy="96" r="2.2" fill="#e6cfa3" opacity="0.45" />
    </g>
  </svg>

  <!-- ══════════ 捕鱼：深海 · 金龙鱼 · 光柱气泡 ══════════ -->
  <svg v-else-if="game === 'fishing'" :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="fsSea" x1="0" y1="0" x2="0.1" y2="1">
        <stop offset="0" stop-color="#0e3550" />
        <stop offset="0.45" stop-color="#0a2338" />
        <stop offset="1" stop-color="#04131f" />
      </linearGradient>
      <linearGradient id="fsRay2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fd8ef" stop-opacity="0.3" />
        <stop offset="1" stop-color="#8fd8ef" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="fsBody2" x1="0.1" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="#ffeec0" />
        <stop offset="0.42" stop-color="#e0b45e" />
        <stop offset="1" stop-color="#9a6c24" />
      </linearGradient>
      <linearGradient id="fsFin2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f2d492" stop-opacity="0.95" />
        <stop offset="1" stop-color="#a2762c" stop-opacity="0.85" />
      </linearGradient>
      <radialGradient id="fsGlow2" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ffd88a" stop-opacity="0.32" />
        <stop offset="1" stop-color="#ffd88a" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="fsBelly" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7d5410" stop-opacity="0" />
        <stop offset="0.55" stop-color="#6b460c" stop-opacity="0.35" />
        <stop offset="1" stop-color="#4a2f06" stop-opacity="0.6" />
      </linearGradient>
      <linearGradient id="fsRim" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#fff6dc" stop-opacity="0.95" />
        <stop offset="0.55" stop-color="#ffe6a8" stop-opacity="0.25" />
        <stop offset="1" stop-color="#ffe6a8" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="fsSurface" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9fe3f2" stop-opacity="0.22" />
        <stop offset="1" stop-color="#9fe3f2" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="fsNetRope" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#fff2cf" />
        <stop offset="0.5" stop-color="#d9b877" />
        <stop offset="1" stop-color="#8a6b3c" />
      </linearGradient>
      <clipPath id="fsNetClip">
        <path d="M62 108 C118 80 178 102 190 158 C202 218 158 254 104 246 C56 238 38 162 62 108 z" />
      </clipPath>
      <!-- 鳞片裁切轮廓（坐标与鱼身局部坐标系一致） -->
      <clipPath id="fsBodyClip">
        <path d="M-86 0 C-58 -50 -8 -66 40 -56 C82 -47 112 -26 124 0 C112 26 82 47 40 56 C-8 66 -58 50 -86 0 z" />
      </clipPath>
    </defs>

    <rect width="100%" height="100%" fill="url(#fsSea)" />
    <g :transform="fit">
    <!-- 海面与焦散（窄卡时补足上方空场） -->
    <rect x="-200" y="-120" width="820" height="120" fill="url(#fsSurface)" />
    <g stroke="#bfe8f2" stroke-opacity="0.2" stroke-width="1.6" fill="none" class="ray-b">
      <path d="M-40 -14 q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0" />
      <path d="M-40 -36 q46 -13 92 0 t92 0 t92 0 t92 0 t92 0" stroke-opacity="0.11" />
    </g>

    <!-- 水下光柱（贯穿全幅，宽/窄两种构图都不断裂） -->
    <path d="M50.4 -80 L107.2 -80 L252.8 480 L117.6 480 z" fill="url(#fsRay2)" class="ray-a" />
    <path d="M236.8 -80 L280.3 -80 L362.4 480 L259.2 480 z" fill="url(#fsRay2)" opacity="0.7" class="ray-b" />
    <!-- 远景鱼群剪影 -->
    <g fill="#123c58" opacity="0.95">
      <path d="M244 62 l18 -8 -4 8 4 8 z" /><path d="M270 78 l15 -7 -3 7 3 7 z" />
      <path d="M222 88 l13 -6 -3 6 3 6 z" /><path d="M292 56 l13 -6 -3 6 3 6 z" />
      <path d="M252 104 l11 -5 -2 5 2 5 z" /><path d="M196 66 l12 -5 -3 5 3 5 z" />
    </g>
    <!-- 主视觉：金龙鱼（Boss 级，逆光鎏金） -->
    <g transform="translate(196 158)">
      <ellipse cx="0" cy="0" rx="150" ry="96" fill="url(#fsGlow2)" />

      <!-- 尾鳍（双叶 + 鳍骨） -->
      <path d="M-84 0 C-108 -30 -124 -40 -146 -46 c8 20 12 32 12 46 c0 14 -4 26 -12 46 c22 -6 38 -16 62 -46 z" fill="url(#fsFin2)" />
      <g stroke="#8a6526" stroke-opacity="0.42" stroke-width="1.2" fill="none">
        <path d="M-88 -6 C-106 -22 -122 -32 -140 -40" /><path d="M-88 6 C-106 22 -122 32 -140 40" />
        <path d="M-90 -1 C-108 -8 -122 -12 -136 -14" /><path d="M-90 1 C-108 8 -122 12 -136 14" />
      </g>

      <!-- 背鳍（鳍膜 + 鳍条） -->
      <path d="M-30 -34 C-16 -66 16 -78 52 -74 C34 -58 26 -46 20 -32 z" fill="url(#fsFin2)" />
      <g stroke="#8a6526" stroke-opacity="0.38" stroke-width="1.1" fill="none">
        <path d="M-16 -42 C-8 -56 4 -64 18 -68" /><path d="M2 -44 C10 -56 22 -64 36 -70" />
      </g>
      <!-- 腹鳍 -->
      <path d="M-6 36 C-10 62 -24 76 -46 84 c22 8 44 -2 62 -30 z" fill="url(#fsFin2)" />

      <!-- 身体 -->
      <path
        d="M-86 0 C-58 -50 -8 -66 40 -56 C82 -47 112 -26 124 0 C112 26 82 47 40 56 C-8 66 -58 50 -86 0 z"
        fill="url(#fsBody2)"
        stroke="#7d5a20"
        stroke-width="1.5"
      />
      <!-- 腹部暗面（体积感） -->
      <path
        d="M-86 0 C-58 -12 -20 -16 24 -14 C70 -12 106 -8 124 0 C112 26 82 47 40 56 C-8 66 -58 50 -86 0 z"
        fill="url(#fsBelly)"
      />

      <!-- 鳞纹：四排细鳞，按体形裁切（比单层弧线更接近真实鳞甲） -->
      <g clip-path="url(#fsBodyClip)" fill="none" stroke="#8a6526" stroke-opacity="0.32" stroke-width="1.1">
        <path v-for="k in 8" :key="`sa${k}`" :d="scaleArc(k, -38, 16)" />
        <path v-for="k in 8" :key="`sb${k}`" :d="scaleArc(k, -13, 20)" />
        <path v-for="k in 8" :key="`sc${k}`" :d="scaleArc(k, 13, 18)" />
        <path v-for="k in 8" :key="`sd${k}`" :d="scaleArc(k, 38, 15)" />
      </g>
      <!-- 主体轮廓弧（保留原有节奏，压低对比） -->
      <g fill="none" stroke="#8a6526" stroke-opacity="0.34" stroke-width="1.3">
        <path d="M-14 -38 a38 38 0 0 1 0 76" /><path d="M28 -44 a44 44 0 0 1 0 88" />
        <path d="M70 -32 a32 32 0 0 1 0 64" />
      </g>

      <!-- 胸鳍（近侧，压在身体之上） -->
      <path d="M46 12 C60 34 58 54 44 68 C30 56 24 34 30 14 z" fill="url(#fsFin2)" opacity="0.92" />
      <path d="M40 20 C50 36 50 50 44 62" fill="none" stroke="#8a6526" stroke-opacity="0.4" stroke-width="1.1" />

      <!-- 头部 / 鳃盖 -->
      <path d="M96 -28 C116 -18 126 -8 124 0 C126 8 116 18 96 28 C104 10 104 -10 96 -28 z" fill="#f0d089" opacity="0.75" />
      <path d="M86 -34 C96 -14 96 14 86 34" fill="none" stroke="#8a6526" stroke-opacity="0.55" stroke-width="1.6" />
      <path d="M94 -24 C102 -9 102 9 94 24" fill="none" stroke="#8a6526" stroke-opacity="0.3" stroke-width="1.1" />
      <!-- 眼 -->
      <circle cx="104" cy="-10" r="8" fill="#2a1c06" opacity="0.5" />
      <circle cx="104" cy="-10" r="7.5" fill="#fff" />
      <circle cx="106.5" cy="-9" r="4.2" fill="#1d232e" />
      <circle cx="104.6" cy="-11.4" r="1.5" fill="#fff" />
      <!-- 龙须 -->
      <path d="M124 4 q22 12 18 30" fill="none" stroke="#f2d492" stroke-width="2.4" stroke-linecap="round" opacity="0.85" />
      <path d="M120 12 q16 18 8 32" fill="none" stroke="#f2d492" stroke-width="2" stroke-linecap="round" opacity="0.7" />

      <!-- 背脊轮廓光（金属逆光的关键：一条锐利的高光边） -->
      <path
        d="M-86 0 C-58 -50 -8 -66 40 -56 C82 -47 112 -26 124 0"
        fill="none"
        stroke="url(#fsRim)"
        stroke-width="2.6"
        stroke-linecap="round"
      />
      <!-- 体表反射 -->
      <ellipse cx="10" cy="-30" rx="46" ry="12" fill="#fff" opacity="0.26" transform="rotate(-8 10 -30)" />
      <ellipse cx="66" cy="-20" rx="16" ry="5" fill="#fff" opacity="0.2" transform="rotate(-14 66 -20)" />
    </g>
    <!-- 金色渔网罩住鱼身后半（捕鱼语义最直接的符号，留出头部保证主体可读） -->
    <g class="net">
      <g clip-path="url(#fsNetClip)" fill="none" stroke="#f2d492" stroke-opacity="0.42" stroke-width="1.4">
        <path v-for="i in 20" :key="`nma${i}`" :d="`M${-60 + (i - 1) * 20} 50 L${120 + (i - 1) * 20} 290`" />
        <path v-for="i in 20" :key="`nmb${i}`" :d="`M${-60 + (i - 1) * 20} 290 L${120 + (i - 1) * 20} 50`" />
      </g>
      <path
        d="M62 108 C118 80 178 102 190 158 C202 218 158 254 104 246 C56 238 38 162 62 108 z"
        fill="none"
        stroke="url(#fsNetRope)"
        stroke-width="3.4"
        stroke-linecap="round"
        opacity="0.9"
      />
      <!-- 收口绳 -->
      <path d="M70 232 C50 260 40 288 34 316" fill="none" stroke="url(#fsNetRope)" stroke-width="2.6" stroke-linecap="round" opacity="0.7" />
      <path d="M104 246 C88 276 76 300 66 326" fill="none" stroke="url(#fsNetRope)" stroke-width="2.2" stroke-linecap="round" opacity="0.55" />
      <!-- 网坠 -->
      <circle cx="62" cy="108" r="3.4" fill="#f2d492" opacity="0.9" />
      <circle cx="190" cy="158" r="3.8" fill="#f2d492" opacity="0.9" />
      <circle cx="104" cy="246" r="3.2" fill="#f2d492" opacity="0.8" />
    </g>

    <!-- 爆金：击杀掉落（“Boss 爆金”的视觉承诺） -->
    <g v-for="c in hitCoins" :key="`hc${c.i}`" :transform="`translate(${c.x} ${c.y}) rotate(${c.r})`">
      <ellipse cx="0" cy="2" :rx="c.s" :ry="c.s * 0.9" fill="#8a6b3c" />
      <ellipse cx="0" cy="0" :rx="c.s" :ry="c.s * 0.9" fill="#f2d58a" />
      <ellipse cx="0" cy="0" :rx="c.s * 0.54" :ry="c.s * 0.48" fill="none" stroke="#a87c2e" stroke-width="1.1" />
      <ellipse :cx="-c.s * 0.3" :cy="-c.s * 0.3" :rx="c.s * 0.3" :ry="c.s * 0.18" fill="#fffaf0" opacity="0.65" />
    </g>
    <path d="M198 120 l4 -10 4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 z" fill="#fff6de" opacity="0.7" />
    <path d="M84 176 l3 -7 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 z" fill="#fff6de" opacity="0.5" />
    <!-- 海床与珊瑚（右侧成组，左下留给炮台） -->
    <path d="M-40 400 C60 358 140 386 222 358 C292 336 352 362 460 344 L460 480 L-40 480 z" fill="#072536" opacity="0.92" />
    <g stroke="#0e4055" stroke-linecap="round" fill="none">
      <path d="M322 372 q10 -40 -6 -62 M322 372 q-16 -26 -36 -36" stroke-width="7" />
      <path d="M262 366 q6 -26 -4 -44" stroke-width="5" opacity="0.8" />
      <path d="M296 370 q-4 -22 4 -34" stroke-width="4" opacity="0.6" />
    </g>
    <!-- 气泡（沿鱼身上升） -->
    <g fill="none" stroke="#bfe8f2">
      <circle cx="262" cy="212" r="6.5" stroke-width="1.7" opacity="0.75" class="bub-a" />
      <circle cx="284" cy="186" r="4.4" stroke-width="1.4" opacity="0.6" class="bub-b" />
      <circle cx="246" cy="166" r="3" stroke-width="1.2" opacity="0.5" class="bub-c" />
      <circle cx="160" cy="132" r="3.8" stroke-width="1.3" opacity="0.55" class="bub-b" />
      <circle cx="182" cy="108" r="2.4" stroke-width="1.1" opacity="0.4" class="bub-c" />
    </g>
    </g>
  </svg>

  <!-- ══════════ 黄金水果：黑金转轮 · 7/BAR/樱桃 · 币粒 ══════════ -->
  <svg v-else :viewBox="vb" preserveAspectRatio="xMidYMid slice" class="poster">
    <defs>
      <linearGradient id="slBg2" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#2a1c3c" />
        <stop offset="0.5" stop-color="#161028" />
        <stop offset="1" stop-color="#0b0714" />
      </linearGradient>
      <radialGradient id="slHalo" cx="0.5" cy="0.42" r="0.58">
        <stop offset="0" stop-color="#f0c46a" stop-opacity="0.26" />
        <stop offset="1" stop-color="#f0c46a" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="slFrame2" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stop-color="#f7e7bd" />
        <stop offset="0.42" stop-color="#cfa768" />
        <stop offset="1" stop-color="#7d5f2c" />
      </linearGradient>
      <linearGradient id="slWin2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d1120" />
        <stop offset="0.5" stop-color="#1b2138" />
        <stop offset="1" stop-color="#0d1120" />
      </linearGradient>
    </defs>

    <rect width="100%" height="100%" fill="url(#slBg2)" />
    <g :transform="fit">
    <rect x="-200" y="-160" width="820" height="700" fill="url(#slHalo)" />
    <!-- 放射流光 -->
    <g opacity="0.16" class="spin-slow" style="transform-origin: 210px 150px">
      <path v-for="i in 12" :key="`r${i}`" :d="rayPath(i)" fill="#f0c46a" />
    </g>

    <!-- 机体 -->
    <rect x="44" y="66" width="332" height="176" rx="26" fill="url(#slFrame2)" />
    <rect x="44" y="66" width="332" height="176" rx="26" fill="none" stroke="#6e5426" stroke-width="2" />
    <rect x="58" y="80" width="304" height="148" rx="18" fill="url(#slWin2)" stroke="#3a4358" stroke-width="1.4" />
    <!-- 列分隔与筒身明暗 -->
    <path d="M159 80 v148 M261 80 v148" stroke="#3a4358" stroke-width="2" />
    <rect x="58" y="80" width="304" height="26" rx="10" fill="#05070c" opacity="0.55" />
    <rect x="58" y="202" width="304" height="26" rx="10" fill="#05070c" opacity="0.55" />

    <!-- 符号：樱桃 / 7 / BAR -->
    <g transform="translate(108 154)">
      <path d="M-4 -34 C0 -22 4 -14 8 -6 M-4 -34 C-14 -22 -18 -13 -18 -3" stroke="#4c7a3a" stroke-width="4" fill="none" stroke-linecap="round" />
      <path d="M-4 -34 c9 -6 18 -6 25 -2 c-9 3 -16 3 -25 2 z" fill="#5b9146" />
      <circle cx="10" cy="8" r="15" fill="#c22b3a" /><circle cx="-18" cy="12" r="13" fill="#a8202e" />
      <circle cx="5" cy="2" r="4.5" fill="#fff" opacity="0.5" />
    </g>
    <g transform="translate(210 154)">
      <path d="M-24 -36 h50 l-18 72 h-18 l16 -50 h-30 z" fill="#7d1d22" transform="translate(4 4)" />
      <path d="M-24 -36 h50 l-18 72 h-18 l16 -50 h-30 z" fill="#d6363c" />
      <path d="M-24 -36 h50 l-4 8 h-46 z" fill="#fff" opacity="0.3" />
    </g>
    <g transform="translate(312 154)">
      <rect x="-34" y="-28" width="68" height="20" rx="5" fill="#e8c05e" stroke="#8a6b1e" stroke-width="1.6" />
      <rect x="-34" y="-6" width="68" height="20" rx="5" fill="#e8c05e" stroke="#8a6b1e" stroke-width="1.6" />
      <rect x="-34" y="16" width="68" height="20" rx="5" fill="#e8c05e" stroke="#8a6b1e" stroke-width="1.6" />
      <text x="0" y="8" text-anchor="middle" font-size="15" font-weight="900" fill="#6e5426" font-family="system-ui">BAR</text>
    </g>

    <!-- 顶部灯饰与拉杆 -->
    <g>
      <rect x="150" y="52" width="120" height="16" rx="8" fill="url(#slFrame2)" />
      <circle cx="176" cy="60" r="4" fill="#fff3d0" opacity="0.9" />
      <circle cx="210" cy="60" r="4" fill="#ffd88a" opacity="0.75" />
      <circle cx="244" cy="60" r="4" fill="#fff3d0" opacity="0.9" />
      <rect x="366" y="120" width="10" height="70" rx="5" fill="#8a6b3c" />
      <circle cx="371" cy="112" r="14" fill="#c22b3a" stroke="#7d1d22" stroke-width="2" />
      <circle cx="367" cy="107" r="4" fill="#fff" opacity="0.4" />
    </g>

    <!-- 币粒 -->
    <g>
      <g v-for="c in coins" :key="`c${c.i}`" :transform="`translate(${c.x} ${c.y}) rotate(${c.r})`">
        <ellipse cx="0" cy="2" rx="11" ry="10" fill="#8a6b3c" />
        <ellipse cx="0" cy="0" rx="11" ry="10" fill="#e8c976" />
        <ellipse cx="0" cy="0" rx="6" ry="5.4" fill="none" stroke="#a87c2e" stroke-width="1.2" />
        <ellipse cx="-3" cy="-3" rx="3.4" ry="2" fill="#fff" opacity="0.5" />
      </g>
    </g>
    <path d="M62 258 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z" fill="#f2df9e" opacity="0.85" />
    <path d="M356 46 l2.6 5 5 2.6 -5 2.6 -2.6 5 -2.6 -5 -5 -2.6 5 -2.6 z" fill="#f2df9e" opacity="0.7" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ game: string; layout?: 'wide' | 'tall' }>(), { layout: 'wide' });

/**
 * 双构图：wide 用于旗舰横卡；tall 用于窄卡（缩放并上移场景，
 * 保证主体落在安全区、不被底部文字压住，也不被左右裁掉）。
 */
const vb = computed(() => (props.layout === 'tall' ? '0 0 300 430' : '0 0 420 300'));

/**
 * 窄卡安全区：卡片宽高比（≈0.63）窄于窗口比（300/430≈0.70），
 * slice 会横向裁掉约 15 个单位，因此每个场景单独定标定位，
 * 保证主体（鱼尾/拉杆/筹码）完整落在 x∈[18,282]、y∈[70,340] 内。
 * anchor = 宽版坐标系中希望落在窄卡 (150, 182) 的那个点。
 */
const TALL: Record<string, { s: number; ax: number; ay: number }> = {
  mahjong_yanbian: { s: 1, ax: 210, ay: 186 },
  hongshi: { s: 0.8, ax: 211, ay: 206 },
  fishing: { s: 0.8, ax: 185, ay: 168 },
  slot_fruit: { s: 0.68, ax: 214, ay: 158 },
};

const fit = computed(() => {
  if (props.layout !== 'tall') {
    // 宽卡：场景整体上移，主体避开底部文字区（上移过多会把吊灯/屏风裁掉）
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

const coins = [
  { i: 1, x: 84, y: 250, r: -14 },
  { i: 2, x: 120, y: 262, r: 22 },
  { i: 3, x: 156, y: 252, r: 8 },
  { i: 4, x: 268, y: 258, r: -20 },
  { i: 5, x: 302, y: 248, r: 16 },
  { i: 6, x: 336, y: 262, r: -6 },
];

/** 鱼身鳞片弧：沿体轴等距排布，由 fsBodyClip 裁到体形内 */
function scaleArc(k: number, y: number, r: number): string {
  const x = -64 + (k - 1) * 24;
  const h = (r * 0.62).toFixed(1);
  return `M${x} ${(y - Number(h)).toFixed(1)} a${r} ${r} 0 0 1 0 ${(Number(h) * 2).toFixed(1)}`;
}

function rayPath(i: number): string {
  const a0 = (Math.PI * 2 * (i - 1)) / 12;
  const a1 = a0 + 0.12;
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
