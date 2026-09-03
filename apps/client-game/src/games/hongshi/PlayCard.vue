<template>
  <!--
    扑克牌：牌面使用 Vector Playing Cards（Byron Knoll，公共领域，见 THIRD_PARTY_ASSETS.md）。
    数字牌为 SVG（5–13KB），J/Q/K 为本项目光栅化的 WebP（60–74KB）。牌背为本项目原创 CSS。
  -->
  <div class="pcard" :class="[{ back, selected, identity }, `s${size}`]">
    <img v-if="!back" class="face" :src="src" :alt="label" draggable="false" decoding="async" />
    <span v-if="identity && !back" class="idmark">十</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ card?: number; back?: boolean; selected?: boolean; size?: 'md' | 'sm' | 'xs' }>(), {
  card: 0,
  back: false,
  selected: false,
  size: 'md',
});

/** 花色顺序与引擎一致：0 方块 1 梅花 2 红桃 3 黑桃 */
const SUIT_CODE = ['D', 'C', 'H', 'S'];
const SUIT_NAME = ['方块', '梅花', '红桃', '黑桃'];
const RANK_CODE = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suit = computed(() => Math.floor(props.card / 13));
const rank = computed(() => (props.card % 13) + 1);
const isRed = computed(() => suit.value === 0 || suit.value === 2);
const isFace = computed(() => rank.value >= 11);
const src = computed(() => `/assets/red10/cards/${RANK_CODE[rank.value - 1]}${SUIT_CODE[suit.value]}.${isFace.value ? 'webp' : 'svg'}`);
const label = computed(() => `${SUIT_NAME[suit.value]}${RANK_CODE[rank.value - 1]}`);
/** 红十身份牌：红桃10 / 方块10 */
const identity = computed(() => rank.value === 10 && isRed.value);
</script>

<style scoped>
.pcard {
  --w: 52px;
  position: relative;
  width: var(--w);
  height: calc(var(--w) * 1.45);
  border-radius: calc(var(--w) * 0.075);
  background: #fdfbf5;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 calc(var(--w) * 0.06) calc(var(--w) * 0.14) rgba(0, 0, 0, 0.45);
  flex-shrink: 0;
  overflow: hidden;
  transition: transform var(--dur-micro) var(--ease-out);
}
.face {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  user-select: none;
  -webkit-user-drag: none;
}
.pcard.selected {
  transform: translateY(calc(var(--w) * -0.3));
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 calc(var(--w) * 0.2) calc(var(--w) * 0.28) rgba(0, 0, 0, 0.5),
    var(--shadow-glow-gold);
}
/* 牌背：原创 —— 深蓝金格 + 中央纹章 */
.pcard.back {
  background:
    radial-gradient(circle at 50% 50%, rgba(230, 207, 163, 0.14) 0%, transparent 58%),
    repeating-linear-gradient(45deg, rgba(201, 160, 99, 0.16) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(-45deg, rgba(201, 160, 99, 0.16) 0 1px, transparent 1px 7px),
    linear-gradient(160deg, #273349 0%, #161d2c 100%);
  border: 1px solid rgba(201, 160, 99, 0.35);
  box-shadow:
    inset 0 0 0 calc(var(--w) * 0.06) rgba(11, 17, 29, 0.9),
    inset 0 0 0 calc(var(--w) * 0.075) rgba(201, 160, 99, 0.35),
    0 calc(var(--w) * 0.06) calc(var(--w) * 0.14) rgba(0, 0, 0, 0.45);
}
.pcard.identity {
  outline: 2px solid var(--gold-warm);
  outline-offset: -2px;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 calc(var(--w) * 0.06) calc(var(--w) * 0.14) rgba(0, 0, 0, 0.45),
    0 0 12px rgba(201, 160, 99, 0.45);
}
.smd {
  --w: 52px;
}
.ssm {
  --w: 38px;
}
.sxs {
  --w: 26px;
}
.idmark {
  position: absolute;
  right: calc(var(--w) * 0.08);
  top: calc(var(--w) * 0.62);
  font-size: calc(var(--w) * 0.2);
  font-weight: 800;
  line-height: 1;
  color: #241a08;
  background: linear-gradient(180deg, #f6e6bd, #c9a063);
  border-radius: 4px;
  padding: 2px 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}
</style>
