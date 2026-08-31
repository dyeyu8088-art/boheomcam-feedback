<template>
  <!--
    牌桌台面（纯装饰层，不接受指针事件）
    结构：外框（胡桃木+金线嵌条）→ 绒面（织纹+顶灯光斑+暗角）→ 出牌区内圈金线 → 四角朝鲜族角饰
  -->
  <div class="surface" :class="tone" aria-hidden="true">
    <div class="rim">
      <div class="rim-inlay" />
    </div>

    <div class="felt">
      <div class="weave" />
      <div class="pool" />
      <div class="vignette" />
      <div class="hairline" />
      <svg class="corners" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g stroke="#c9a063" stroke-opacity="0.2" stroke-width="0.35" fill="none" vector-effect="non-scaling-stroke">
          <path d="M2 9 V4 a2 2 0 0 1 2 -2 H9" />
          <path d="M91 2 H96 a2 2 0 0 1 2 2 V9" />
          <path d="M98 91 V96 a2 2 0 0 1 -2 2 H91" />
          <path d="M9 98 H4 a2 2 0 0 1 -2 -2 V91" />
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 牌桌配色：emerald=麻将翡翠绒面，wine=红十酒红绒面 */
withDefaults(defineProps<{ tone?: 'emerald' | 'wine' }>(), { tone: 'emerald' });
</script>

<style scoped>
.surface {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

/* ── 外框：胡桃木 + 金色嵌条 ── */
.rim {
  position: absolute;
  inset: 3.2% 2.4%;
  border-radius: 52px;
  background: linear-gradient(158deg, #3c2c1d 0%, #261b12 38%, #17100a 74%, #0f0b07 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 236, 200, 0.16),
    inset 0 -10px 26px rgba(0, 0, 0, 0.62),
    0 26px 64px rgba(0, 0, 0, 0.62);
}
.rim-inlay {
  position: absolute;
  inset: 9px;
  border-radius: 44px;
  border: 1px solid rgba(201, 160, 99, 0.4);
  box-shadow:
    0 0 14px rgba(201, 160, 99, 0.16),
    inset 0 0 18px rgba(0, 0, 0, 0.5);
}

/* ── 绒面 ── */
.felt {
  position: absolute;
  inset: calc(3.2% + 19px) calc(2.4% + 19px);
  border-radius: 38px;
  overflow: hidden;
  box-shadow:
    inset 0 3px 10px rgba(0, 0, 0, 0.55),
    inset 0 0 120px rgba(0, 0, 0, 0.55);
}
.emerald .felt {
  background: radial-gradient(68% 78% at 50% 34%, #1d5942 0%, #144433 34%, #0b2a20 62%, #061810 84%, #04110b 100%);
}
.wine .felt {
  background: radial-gradient(64% 74% at 50% 34%, #55202d 0%, #3d1522 34%, #250a13 62%, #15050a 84%, #0d0307 100%);
}
/* 绒布织纹：两个方向的极淡斜线，模拟绒面纤维 */
.weave {
  position: absolute;
  inset: 0;
  opacity: 0.45;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.022) 0 2px, transparent 2px 5px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.05) 0 2px, transparent 2px 5px);
}
/* 顶灯落在桌面的椭圆光斑 */
.pool {
  position: absolute;
  left: 50%;
  top: 27%;
  width: 62%;
  height: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 240, 205, 0.085) 0%, rgba(255, 240, 205, 0.035) 46%, transparent 72%);
  filter: blur(18px);
}
.vignette {
  position: absolute;
  inset: 0;
}
.emerald .vignette {
  background:
    radial-gradient(62% 68% at 50% 40%, transparent 20%, rgba(2, 10, 7, 0.5) 68%, rgba(1, 6, 4, 0.82) 100%),
    linear-gradient(180deg, rgba(1, 6, 4, 0.42) 0%, transparent 18%, transparent 74%, rgba(1, 6, 4, 0.5) 100%);
}
.wine .vignette {
  background:
    radial-gradient(62% 68% at 50% 40%, transparent 20%, rgba(10, 3, 6, 0.5) 68%, rgba(6, 2, 4, 0.84) 100%),
    linear-gradient(180deg, rgba(6, 2, 4, 0.42) 0%, transparent 18%, transparent 74%, rgba(6, 2, 4, 0.52) 100%);
}
/* 出牌区内圈：告诉玩家“牌河在这里” */
.hairline {
  position: absolute;
  inset: 17% 13%;
  border-radius: 34px;
  border: 1px solid rgba(201, 160, 99, 0.13);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.24);
}
.corners {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

@media (max-width: 720px), (max-height: 480px) {
  .rim {
    inset: 1.6% 1.2%;
    border-radius: 32px;
  }
  .rim-inlay {
    inset: 6px;
    border-radius: 27px;
  }
  .felt {
    inset: calc(1.6% + 13px) calc(1.2% + 13px);
    border-radius: 22px;
  }
  .hairline {
    inset: 15% 9%;
    border-radius: 22px;
  }
}
</style>
