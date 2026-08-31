<template>
  <div class="pcard" :class="[{ back, selected, red: isRed, identity }, `s${size}`]">
    <template v-if="!back">
      <div class="corner tl">
        <span class="r">{{ rankSym }}</span>
        <span class="s">{{ suitSym }}</span>
      </div>
      <div class="pip">{{ suitSym }}</div>
      <div class="corner br">
        <span class="r">{{ rankSym }}</span>
        <span class="s">{{ suitSym }}</span>
      </div>
      <div v-if="identity" class="idmark">十</div>
    </template>
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

const SUITS = ['♦', '♣', '♥', '♠'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suit = computed(() => Math.floor(props.card / 13));
const rank = computed(() => (props.card % 13) + 1);
const suitSym = computed(() => SUITS[suit.value]);
const rankSym = computed(() => RANKS[rank.value - 1]);
const isRed = computed(() => suit.value === 0 || suit.value === 2);
/** 红十身份牌：红桃10 / 方块10 */
const identity = computed(() => rank.value === 10 && isRed.value);
</script>

<style scoped>
.pcard {
  --w: 52px;
  position: relative;
  width: var(--w);
  height: calc(var(--w) * 1.42);
  border-radius: calc(var(--w) * 0.12);
  background: linear-gradient(180deg, #fdfbf5 0%, #f1ece0 100%);
  box-shadow: 0 calc(var(--w) * 0.06) calc(var(--w) * 0.14) rgba(0, 0, 0, 0.45);
  color: #232733;
  flex-shrink: 0;
  transition: transform var(--dur-micro) var(--ease-out);
}
.pcard.red {
  color: #b03030;
}
.pcard.selected {
  transform: translateY(calc(var(--w) * -0.3));
  box-shadow:
    0 calc(var(--w) * 0.2) calc(var(--w) * 0.28) rgba(0, 0, 0, 0.5),
    var(--shadow-glow-gold);
}
.pcard.back {
  background:
    radial-gradient(circle at 50% 50%, rgba(230, 207, 163, 0.12) 0%, transparent 60%),
    linear-gradient(160deg, #273349 0%, #161d2c 100%);
  border: 1px solid rgba(201, 160, 99, 0.25);
}
.pcard.identity {
  outline: 2px solid var(--gold-warm);
  outline-offset: -2px;
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
.corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}
.corner.tl {
  top: calc(var(--w) * 0.07);
  left: calc(var(--w) * 0.09);
}
.corner.br {
  bottom: calc(var(--w) * 0.07);
  right: calc(var(--w) * 0.09);
  transform: rotate(180deg);
}
.r {
  font-size: calc(var(--w) * 0.26);
  font-weight: 800;
}
.s {
  font-size: calc(var(--w) * 0.22);
}
.pip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--w) * 0.5);
  opacity: 0.85;
}
.idmark {
  position: absolute;
  right: calc(var(--w) * 0.08);
  top: calc(var(--w) * 0.34);
  font-size: calc(var(--w) * 0.2);
  font-weight: 800;
  color: var(--gold-deep);
  background: rgba(201, 160, 99, 0.25);
  border-radius: 4px;
  padding: 1px 3px;
}
</style>
