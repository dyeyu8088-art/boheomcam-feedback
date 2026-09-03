<template>
  <GamePopup :model-value="modelValue" :title="t('vip.title')" skin="blue" size="md" @update:model-value="$emit('update:modelValue', $event)">
    <div v-if="info" class="vip">
      <div class="vip-top">
        <VipBadge :level="info.level" size="lg" />
        <div class="vip-exp">
          <div class="vip-lv sk-gold-text">VIP {{ info.level }}</div>
          <ProgressBar :value="ratio" tone="gold" :text="info.next ? `${info.exp} / ${info.next.expRequired}` : t('vip.max')" class="vip-bar" />
          <p class="vip-next">{{ info.next ? t('vip.nextLevel', { n: info.next.level, e: info.next.expRequired - info.exp }) : t('vip.maxHint') }}</p>
        </div>
      </div>
      <ul class="vip-perks">
        <li><span>{{ t('vip.perks.dailyBonus') }}</span><b class="num">{{ fmt(info.perks.dailyBonus ?? 0) }}</b></li>
        <li><span>{{ t('vip.perks.bonusRate') }}</span><b class="num">{{ ((info.perks.bonusRateBp ?? 0) / 100).toFixed(1) }}%</b></li>
      </ul>
      <p class="vip-how">{{ t('vip.how') }}</p>
      <div class="vip-actions">
        <GameButton variant="gold" size="lg" :disabled="!((info.perks.dailyBonus ?? 0) > 0) || info.dailyClaimed || pending" :loading="pending" sfx="confirm" @click="claim">
          {{ info.dailyClaimed ? t('vip.claimed') : t('vip.daily') }}
        </GameButton>
      </div>
      <table class="vip-table">
        <thead>
          <tr><th>VIP</th><th>{{ t('vip.exp') }}</th><th>{{ t('vip.perks.dailyBonus') }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in info.levels" :key="l.level" :class="{ cur: l.level === info.level }">
            <td>{{ l.level }}</td><td class="num">{{ fmt(l.expRequired) }}</td><td class="num">{{ fmt(l.perks.dailyBonus ?? 0) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <RewardAnimation ref="reward" />
  </GamePopup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '../../net/api.js';
import { t } from '../../i18n/index.js';
import { useUserStore } from '../../stores/user.js';
import { toast } from '../../ui/toast.js';
import { fmt } from '../../ui/format.js';
import GamePopup from '../../ui/GamePopup.vue';
import GameButton from '../../ui/GameButton.vue';
import VipBadge from '../../ui/VipBadge.vue';
import ProgressBar from '../../ui/ProgressBar.vue';
import RewardAnimation from '../../ui/RewardAnimation.vue';

interface VipInfo {
  level: number;
  exp: number;
  expRequired: number;
  next: { level: number; expRequired: number } | null;
  perks: { dailyBonus?: number; bonusRateBp?: number };
  levels: { level: number; expRequired: number; perks: { dailyBonus?: number } }[];
  dailyClaimed: boolean;
}
const props = defineProps<{ modelValue: boolean }>();
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
const user = useUserStore();
const info = ref<VipInfo | null>(null);
const pending = ref(false);
const reward = ref<InstanceType<typeof RewardAnimation> | null>(null);
const ratio = computed(() => {
  const i = info.value;
  if (!i || !i.next) return 1;
  const span = i.next.expRequired - i.expRequired;
  return span > 0 ? (i.exp - i.expRequired) / span : 1;
});
async function load(): Promise<void> {
  try {
    info.value = await api<VipInfo>('/api/v1/vip');
  } catch {
    /* noop */
  }
}
watch(
  () => props.modelValue,
  (v) => v && void load(),
  { immediate: true },
);
async function claim(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  try {
    const r = await api<{ amount: number; balanceAfter: number }>('/api/v1/vip/daily', {});
    user.setBalance(r.balanceAfter);
    reward.value?.play({ amount: r.amount, caption: t('vip.daily') });
    await load();
  } catch (e) {
    toast((e as Error).message, 'error');
  } finally {
    pending.value = false;
  }
}
</script>

<style scoped>
.vip {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.vip-top {
  display: flex;
  align-items: center;
  gap: 16px;
}
.vip-exp {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.vip-lv {
  font-size: 26px;
}
.vip-bar {
  --h: 24px;
}
.vip-next {
  margin: 0;
  font-size: 12px;
  color: #9fb4e8;
}
.vip-perks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.vip-perks li {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  font-size: 13px;
}
.vip-perks b {
  color: #ffe28a;
}
.vip-how {
  margin: 0;
  font-size: 12px;
  color: #9fb4e8;
}
.vip-actions {
  display: flex;
  justify-content: center;
}
.vip-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.vip-table th,
.vip-table td {
  padding: 5px 8px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.vip-table th {
  color: #ffe28a;
}
.vip-table tr.cur td {
  background: rgba(248, 199, 74, 0.15);
  color: #fff6d5;
  font-weight: 800;
}
</style>
