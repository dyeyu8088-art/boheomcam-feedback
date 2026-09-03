<template>
  <!--
    麻将牌：牌面使用 riichi-mahjong-tiles（FluffyStuff，CC0，见 THIRD_PARTY_ASSETS.md）
    的「牌体 Front + 花色叠层」两层合成；牌背与 2.5D 侧面为本项目原创 CSS。
  -->
  <div class="tile" :class="[`s${size}`, { back, selected, disabled }]">
    <template v-if="!back">
      <img class="layer" src="/assets/mahjong/Front.svg" alt="" draggable="false" decoding="async" />
      <img class="layer face" :src="faceSrc" :alt="label" draggable="false" decoding="async" />
      <span class="gloss" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ kind?: number; back?: boolean; size?: 'lg' | 'md' | 'sm' | 'xs'; selected?: boolean; disabled?: boolean }>(),
  { kind: 0, back: false, size: 'md', selected: false, disabled: false },
);

/** kind 0–8 万 / 9–17 条 / 18–26 筒 / 27–33 東南西北中發白（与引擎一致） */
const SUIT_FILE = ['Man', 'Sou', 'Pin'];
const HONOR_FILE = ['Ton', 'Nan', 'Shaa', 'Pei', 'Chun', 'Hatsu', 'Haku'];
const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUIT_CN = ['萬', '條', '筒'];
const HONOR_CN = ['東', '南', '西', '北', '中', '發', '白'];
const suit = computed(() => (props.kind < 27 ? Math.floor(props.kind / 9) : 3));
const rank = computed(() => (props.kind < 27 ? (props.kind % 9) + 1 : props.kind - 26));
const faceSrc = computed(() =>
  suit.value < 3 ? `/assets/mahjong/${SUIT_FILE[suit.value]}${rank.value}.svg` : `/assets/mahjong/${HONOR_FILE[rank.value - 1]}.svg`,
);
const label = computed(() => (suit.value < 3 ? `${CN[rank.value - 1]}${SUIT_CN[suit.value]}` : HONOR_CN[rank.value - 1]!));
</script>

<style scoped>
.tile {
  --w: 44px;
  position: relative;
  width: var(--w);
  height: calc(var(--w) * 1.34);
  border-radius: calc(var(--w) * 0.13);
  /* 象牙牌体由 Front.svg 提供；这里只补 2.5D 侧面与离地投影 */
  background: #ece2cc;
  box-shadow:
    0 calc(var(--w) * 0.07) 0 #2e6e50,
    0 calc(var(--w) * 0.16) calc(var(--w) * 0.2) rgba(0, 0, 0, 0.45);
  flex-shrink: 0;
  overflow: hidden;
  transition: transform var(--dur-micro) var(--ease-out);
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}
/* 面部斜切高光（抛光感） */
.gloss {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(122deg, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 36%);
  pointer-events: none;
}
.tile.selected {
  transform: translateY(calc(var(--w) * -0.28));
  box-shadow:
    0 calc(var(--w) * 0.07) 0 #2e6e50,
    0 calc(var(--w) * 0.24) calc(var(--w) * 0.3) rgba(0, 0, 0, 0.5),
    var(--shadow-glow-gold);
}
.tile.disabled {
  filter: brightness(0.65);
}
/* 牌背：原创 —— 翡翠绿 + 延边雪晶菱格暗纹 */
.tile.back {
  background: linear-gradient(158deg, #368b64 0%, #2a6f50 44%, #1d5439 78%, #133c28 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 calc(var(--w) * -0.14) calc(var(--w) * 0.2) rgba(0, 0, 0, 0.36),
    0 calc(var(--w) * 0.07) 0 #123524,
    0 calc(var(--w) * 0.14) calc(var(--w) * 0.18) rgba(0, 0, 0, 0.45);
}
.tile.back::after {
  content: '';
  position: absolute;
  inset: 15%;
  border-radius: calc(var(--w) * 0.07);
  border: 1px solid rgba(214, 245, 228, 0.18);
  background:
    linear-gradient(45deg, transparent 46%, rgba(214, 245, 228, 0.14) 46% 54%, transparent 54%),
    linear-gradient(-45deg, transparent 46%, rgba(214, 245, 228, 0.14) 46% 54%, transparent 54%);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
}
.slg {
  --w: 52px;
}
.smd {
  --w: 44px;
}
.ssm {
  --w: 30px;
}
.sxs {
  --w: 22px;
}
</style>
