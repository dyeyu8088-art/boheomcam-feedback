<template>
  <button class="pp" :class="[size, { clickable }]" type="button" @click="clickable && $emit('click')">
    <span class="pp-avatar">
      <AvatarBadge :id="avatarId" :size="avatarPx" :vip="vip > 0" />
    </span>
    <span class="pp-meta">
      <span class="pp-name">{{ nickname }}</span>
      <span class="pp-line">
        <span class="pp-uid num">ID {{ uid }}</span>
        <span class="pp-lv num">Lv.{{ level }}</span>
      </span>
      <span v-if="showExp" class="pp-exp"><i :style="{ width: `${Math.round(expRatio * 100)}%` }" /></span>
    </span>
    <VipBadge v-if="vip > 0" :level="vip" :size="size === 'lg' ? 'md' : 'sm'" class="pp-vip" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AvatarBadge from './AvatarBadge.vue';
import VipBadge from './VipBadge.vue';

/**
 * 玩家资料条：头像纹章（原创）+ 昵称 / ID / 等级 / 经验 + VIP 徽章。
 * 所有文字均为程序绘制；金框底板 CSS 实现，保证任意昵称长度不溢出（ellipsis）。
 */
const props = withDefaults(
  defineProps<{
    nickname: string;
    uid: number | string;
    level: number;
    vip?: number;
    avatarId?: number;
    exp?: number;
    expNext?: number;
    size?: 'md' | 'lg';
    clickable?: boolean;
    showExp?: boolean;
  }>(),
  { vip: 0, avatarId: 1, exp: 0, expNext: 0, size: 'md', clickable: true, showExp: true },
);
defineEmits<{ (e: 'click'): void }>();
const avatarPx = computed(() => (props.size === 'lg' ? 72 : 54));
const expRatio = computed(() => (props.expNext > 0 ? Math.min(1, props.exp / props.expNext) : 0));
</script>

<style scoped>
.pp {
  --h: 66px;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: var(--h);
  max-width: 320px;
  padding: 0 14px 0 6px;
  border: 0;
  border-radius: calc(var(--h) / 2);
  background: linear-gradient(180deg, #17357a, #0a1a4d 60%, #071238);
  box-shadow:
    inset 0 0 0 2px #7d4d0c,
    inset 0 0 0 3.5px #f0c14e,
    inset 0 6px 14px rgba(255, 255, 255, 0.08),
    0 8px 20px rgba(0, 0, 0, 0.5);
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: default;
}
.pp.lg {
  --h: 86px;
  max-width: 420px;
}
.pp.clickable {
  cursor: pointer;
  transition: transform 140ms var(--ease-out);
}
.pp.clickable:hover {
  transform: translateY(-1px);
}
.pp.clickable:active {
  transform: scale(0.98);
}
.pp-avatar {
  flex-shrink: 0;
  border-radius: 50%;
  box-shadow:
    0 0 0 3px #f0c14e,
    0 0 0 5px #7d4d0c,
    0 4px 10px rgba(0, 0, 0, 0.6);
  display: flex;
}
.pp-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.pp-name {
  font-size: calc(var(--h) * 0.24);
  font-weight: 800;
  line-height: 1.1;
  color: #fff8e0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-line {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.pp-uid {
  font-size: calc(var(--h) * 0.16);
  color: #9fb4e8;
}
.pp-lv {
  font-size: calc(var(--h) * 0.15);
  font-weight: 800;
  color: #2a1500;
  background: linear-gradient(180deg, #ffe38b, #f0a730);
  border-radius: 6px;
  padding: 2px 6px;
  box-shadow: inset 0 0 0 1px #8f5a12;
}
.pp-exp {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: #0a1330;
  box-shadow: inset 0 0 0 1px #7d4d0c;
  overflow: hidden;
}
.pp-exp i {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(180deg, #ffe38b, #f39a1e);
  border-radius: 3px;
  transition: width 500ms var(--ease-out);
}
.pp-vip {
  flex-shrink: 0;
}
</style>
