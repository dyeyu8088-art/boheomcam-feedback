<template>
  <div class="tile" :class="[`s${size}`, { back, selected, disabled }]">
    <template v-if="!back">
      <!-- 万 -->
      <div v-if="suit === 0" class="face wan">
        <span class="rank-cn">{{ CN[rank - 1] }}</span>
        <span class="wan-cn">萬</span>
      </div>
      <!-- 条 -->
      <div v-else-if="suit === 1" class="face tiao">
        <div class="sticks" :class="`n${rank}`">
          <span v-for="n in rank" :key="n" class="stick" />
        </div>
      </div>
      <!-- 筒 -->
      <div v-else-if="suit === 2" class="face tong">
        <div class="dots" :class="`n${rank}`">
          <span v-for="n in rank" :key="n" class="dot" />
        </div>
      </div>
      <!-- 字牌 -->
      <div v-else class="face honor" :class="`h${rank}`">
        <span>{{ HONOR[rank - 1] }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ kind?: number; back?: boolean; size?: 'lg' | 'md' | 'sm' | 'xs'; selected?: boolean; disabled?: boolean }>(),
  { kind: 0, back: false, size: 'md', selected: false, disabled: false },
);

const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONOR = ['東', '南', '西', '北', '中', '發', '白'];
const suit = computed(() => (props.kind < 27 ? Math.floor(props.kind / 9) : 3));
const rank = computed(() => (props.kind < 27 ? (props.kind % 9) + 1 : props.kind - 26));
</script>

<style scoped>
.tile {
  --w: 44px;
  position: relative;
  width: var(--w);
  height: calc(var(--w) * 1.38);
  border-radius: calc(var(--w) * 0.14);
  /* 象牙面：左上受光、右下转暗，底部一条绿色侧面构成 2.5D 体积 */
  background: linear-gradient(158deg, #fffdf6 0%, #f7f1e2 42%, #ece2cc 78%, #d4c8ac 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset calc(var(--w) * -0.035) calc(var(--w) * -0.05) calc(var(--w) * 0.1) rgba(120, 104, 72, 0.28),
    0 calc(var(--w) * 0.07) 0 #2e6e50,
    0 calc(var(--w) * 0.16) calc(var(--w) * 0.2) rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--dur-micro) var(--ease-out);
}
/* 面部斜切高光（牌面的“抛光感”） */
.tile:not(.back)::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(122deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 34%);
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
.tile.back {
  background: linear-gradient(158deg, #368b64 0%, #2a6f50 44%, #1d5439 78%, #133c28 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 calc(var(--w) * -0.14) calc(var(--w) * 0.2) rgba(0, 0, 0, 0.36),
    0 calc(var(--w) * 0.07) 0 #123524,
    0 calc(var(--w) * 0.14) calc(var(--w) * 0.18) rgba(0, 0, 0, 0.45);
}
/* 牌背暗纹：延边雪晶菱格（原创，抽象化） */
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
.s-lg,
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
.face {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.wan .rank-cn {
  font-size: calc(var(--w) * 0.42);
  font-weight: 800;
  color: #1c3f66;
  line-height: 1.05;
}
.wan .wan-cn {
  font-size: calc(var(--w) * 0.34);
  font-weight: 800;
  color: #b03030;
  line-height: 1;
}
/* 条 */
.sticks {
  display: grid;
  gap: calc(var(--w) * 0.055);
  place-items: center;
}
.stick {
  width: calc(var(--w) * 0.13);
  height: calc(var(--w) * 0.3);
  border-radius: calc(var(--w) * 0.06);
  background: linear-gradient(180deg, #2c8a5b, #17603b);
}
.n1 {
  grid-template-columns: 1fr;
}
.n1 .stick {
  height: calc(var(--w) * 0.62);
  background: linear-gradient(180deg, #c0392b, #8e2418);
  width: calc(var(--w) * 0.16);
}
.n2 {
  grid-template-rows: repeat(2, auto);
}
.n3 {
  grid-template-rows: repeat(3, auto);
}
.n4 {
  grid-template-columns: repeat(2, auto);
  grid-template-rows: repeat(2, auto);
}
.n5 {
  grid-template-columns: repeat(2, auto);
  grid-template-rows: repeat(3, auto);
}
.n5 .stick:nth-child(5) {
  grid-column: 1 / 3;
}
.n6 {
  grid-template-columns: repeat(2, auto);
}
.n7 {
  grid-template-columns: repeat(2, auto);
}
.n7 .stick:nth-child(1) {
  grid-column: 1 / 3;
}
.n8 {
  grid-template-columns: repeat(2, auto);
}
.n9 {
  grid-template-columns: repeat(3, auto);
}
/* 筒 */
.dots {
  display: grid;
  gap: calc(var(--w) * 0.05);
  place-items: center;
}
.dot {
  width: calc(var(--w) * 0.19);
  height: calc(var(--w) * 0.19);
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #4a7fb5, #1c3f66 70%);
  border: calc(var(--w) * 0.02) solid #14304f;
}
.dots.n1 .dot {
  width: calc(var(--w) * 0.4);
  height: calc(var(--w) * 0.4);
  background: radial-gradient(circle at 34% 30%, #c0392b, #7d1d12 72%);
  border-color: #5f150c;
}
.dots.n2 {
  grid-template-rows: repeat(2, auto);
}
.dots.n3 {
  grid-template-columns: repeat(3, auto);
}
.dots.n3 .dot:nth-child(1) {
  grid-column: 1;
}
.dots.n4 {
  grid-template-columns: repeat(2, auto);
}
.dots.n5 {
  grid-template-columns: repeat(2, auto);
}
.dots.n5 .dot:nth-child(5) {
  grid-column: 1 / 3;
}
.dots.n6 {
  grid-template-columns: repeat(2, auto);
}
.dots.n7 {
  grid-template-columns: repeat(2, auto);
}
.dots.n7 .dot:nth-child(1) {
  grid-column: 1 / 3;
}
.dots.n8 {
  grid-template-columns: repeat(2, auto);
}
.dots.n9 {
  grid-template-columns: repeat(3, auto);
}
/* 字牌 */
.honor span {
  font-size: calc(var(--w) * 0.5);
  font-weight: 800;
}
.h1 span,
.h2 span,
.h3 span,
.h4 span {
  color: #1c3f66;
}
.h5 span {
  color: #b03030;
}
.h6 span {
  color: #17603b;
}
.h7 span {
  color: #8a94a5;
  text-shadow: 0 0 0 #fff;
}
</style>
