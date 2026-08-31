<template>
  <div class="panel">
    <div class="filters">
      <button v-for="r in ranges" :key="r.key" :class="{ on: range === r.key }" @click="setRange(r.key)">
        {{ t(r.label) }}
      </button>
    </div>
    <div v-if="loading" class="list">
      <div v-for="n in 4" :key="n" class="skeleton" style="height: 64px" />
    </div>
    <div v-else-if="items.length === 0" class="empty glass">{{ t('common.empty') }}</div>
    <div v-else class="list">
      <div v-for="it in items" :key="it.round_id" class="rec glass" @click="openDetail(it)">
        <div class="left">
          <div class="gname">{{ t(`game.${it.game_id}`) }}</div>
          <div class="rtime">{{ fmtTime(it.created_at) }} · #{{ String(it.round_id).slice(-6) }}</div>
        </div>
        <div class="score num" :class="it.score_change > 0 ? 'win' : it.score_change < 0 ? 'lose' : ''">
          {{ fmtSigned(it.score_change) }}
        </div>
      </div>
    </div>

    <ModalSheet v-model="showDetail" :title="t('records.detail')" width="460px">
      <div v-if="detail" class="detail">
        <div class="drow head">
          <span>{{ t(`game.${detail.round?.game_id}`) }}</span>
          <span class="dim">{{ detail.round ? fmtTime(detail.round.started_at) : '' }}</span>
        </div>
        <div v-for="p in detail.players" :key="p.user_id" class="drow">
          <span class="person"><AvatarBadge :id="p.avatar_id" :size="26" :ring="false" /> {{ p.nickname }}</span>
          <span class="num" :class="p.score_change > 0 ? 'win' : p.score_change < 0 ? 'lose' : ''">{{ fmtSigned(p.score_change) }}</span>
        </div>
      </div>
    </ModalSheet>
  </div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t } from '../../i18n/index.js';
import ModalSheet from '../../ui/ModalSheet.vue';
import AvatarBadge from '../../ui/AvatarBadge.vue';
import { fmtSigned, fmtTime } from '../../ui/format.js';

const ranges = [
  { key: 'today', label: 'records.today' },
  { key: 'yesterday', label: 'records.yesterday' },
  { key: '7d', label: 'records.7d' },
  { key: '30d', label: 'records.30d' },
];

interface RecItem {
  round_id: number;
  room_id: number;
  game_id: string;
  score_change: number;
  created_at: string;
}

const range = ref('7d');
const items = ref<RecItem[]>([]);
const loading = ref(false);
const showDetail = ref(false);
const detail = ref<{ round: Record<string, any> | null; players: Record<string, any>[] } | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = (await api<{ items: RecItem[] }>(`/api/v1/user/records?range=${range.value}`)).items;
  } catch {
    /* noop */
  } finally {
    loading.value = false;
  }
}
function setRange(r: string): void {
  range.value = r;
  void load();
}
onMounted(load);
onActivated(load);

async function openDetail(it: RecItem): Promise<void> {
  try {
    detail.value = await api(`/api/v1/user/records/${it.round_id}`);
    showDetail.value = true;
  } catch {
    /* noop */
  }
}
</script>

<style scoped>
.panel {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filters {
  display: flex;
  gap: 8px;
}
.filters button {
  flex: 1;
  padding: 8px 0;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg-charcoal);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
}
.filters button.on {
  color: var(--gold-champagne);
  border-color: var(--gold-warm);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rec {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
}
.gname {
  font-weight: 700;
  font-size: 14px;
}
.rtime {
  font-size: 11px;
  color: var(--text-disabled);
  margin-top: 3px;
}
.score {
  font-size: 17px;
  font-weight: 800;
}
.win {
  color: var(--accent-jade);
}
.lose {
  color: var(--accent-crimson);
}
.empty {
  text-align: center;
  padding: 40px;
  color: var(--text-disabled);
}
.detail {
  display: flex;
  flex-direction: column;
}
.drow {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(154, 163, 178, 0.08);
  font-size: 14px;
}
.drow.head {
  color: var(--gold-champagne);
  font-weight: 700;
}
.person {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dim {
  color: var(--text-disabled);
  font-size: 12px;
}
</style>
