<template>
  <div class="panel">
    <div class="col-l">
      <section class="glass hero">
      <AvatarBadge :id="me?.avatarId ?? 1" :size="64" />
      <div class="hinfo">
        <div class="hn">
          {{ me?.nickname }}
          <button class="edit" @click="editing = true">编辑</button>
        </div>
        <div class="hu num">UID {{ me?.uid }} · Lv.{{ me?.level }} <span v-if="me?.vip" class="vip">VIP{{ me?.vip }}</span></div>
      </div>
    </section>

    <section class="stats">
      <div class="stat glass">
        <div class="v num gold">{{ fmt(me?.coins) }}</div>
        <div class="k">{{ t('me.coins') }}</div>
      </div>
      <div class="stat glass">
        <div class="v num blue">{{ fmt(me?.diamonds) }}</div>
        <div class="k">{{ t('me.diamonds') }}</div>
      </div>
      <div class="stat glass">
        <div class="v num">{{ me?.totalRounds ?? 0 }}</div>
        <div class="k">{{ t('me.rounds') }}</div>
      </div>
      <div class="stat glass">
        <div class="v num jade">{{ me?.winRate ?? 0 }}%</div>
        <div class="k">{{ t('me.winRate') }}</div>
      </div>
    </section>
    </div>

    <section class="glass sec">
      <h4>{{ t('me.wallet') }}</h4>
      <EmptyState v-if="txs.length === 0" :title="t('me.wallet.empty')" />
      <div v-for="tx in txs" :key="tx.transaction_id" class="row">
        <div>
          <div class="tt">{{ tx.description ?? tx.type }}</div>
          <div class="dim">{{ fmtTime(tx.created_at) }}</div>
        </div>
        <div class="num" :class="tx.amount > 0 ? 'win' : 'lose'">{{ fmtSigned(tx.amount) }}</div>
      </div>
    </section>

    <ModalSheet v-model="editing" :title="t('me.editName')">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <input v-model="newName" class="input" maxlength="12" :placeholder="me?.nickname" />
        <button class="btn btn-primary" @click="saveName">{{ t('common.confirm') }}</button>
      </div>
    </ModalSheet>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { useUserStore } from '../../stores/user.js';
import { api } from '../../net/api.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import ModalSheet from '../../ui/ModalSheet.vue';
import AvatarBadge from '../../ui/AvatarBadge.vue';
import { fmt, fmtSigned, fmtTime } from '../../ui/format.js';
import EmptyState from '../../ui/EmptyState.vue';

defineEmits<{ (e: 'logout'): void }>();

const user = useUserStore();
const me = computed(() => user.me);
const editing = ref(false);
const newName = ref('');
const txs = ref<{ transaction_id: number; type: string; amount: number; description: string | null; created_at: string }[]>([]);

async function load(): Promise<void> {
  await user.loadMe();
  try {
    txs.value = (await api<{ items: typeof txs.value }>('/api/v1/wallet/transactions')).items.slice(0, 15);
  } catch {
    /* noop */
  }
}
onMounted(load);
onActivated(load);

async function saveName(): Promise<void> {
  try {
    await api('/api/v1/user/profile', { nickname: newName.value.trim() });
    editing.value = false;
    await user.loadMe();
    toast('✓', 'success');
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}
</script>

<style scoped>
/*
  面板宽度：flex 子项上的 `margin: 0 auto` 会取消 align-items:stretch，
  面板会塌成内容宽度，必须显式给 width:100%。
*/
.panel {
  display: grid;
  gap: 18px;
  width: 100%;
  max-width: min(1100px, 92vw);
  margin-inline: auto;
  align-content: start;
}
@media (min-width: 1024px) {
  .panel {
    grid-template-columns: 1fr 1.05fr;
    align-items: start;
    gap: 22px;
  }
}
.col-l {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px;
  border-radius: var(--radius-card);
  box-shadow:
    var(--edge-inner),
    var(--shadow-card);
}
.hn {
  font-size: 18px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}
.edit {
  background: none;
  border: none;
  color: var(--gold-warm);
  cursor: pointer;
  font-size: 14px;
}
.hu {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.vip {
  color: var(--gold-warm);
  font-weight: 700;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.stat {
  padding: 18px 6px;
  text-align: center;
  border-radius: var(--radius-card);
  box-shadow:
    var(--edge-inner),
    var(--shadow-card);
}
.v {
  font-size: 19px;
  font-weight: 800;
}
.v.gold {
  color: var(--gold-champagne);
}
.v.blue {
  color: #7fb8e8;
}
.v.jade {
  color: var(--accent-jade);
}
.k {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.sec {
  padding: 20px 22px 22px;
  border-radius: var(--radius-card);
  box-shadow:
    var(--edge-inner),
    var(--shadow-card);
}
h4 {
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: linear-gradient(180deg, #fff8e6 6%, #e6cfa3 56%, #b3924f 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid rgba(154, 163, 178, 0.08);
  font-size: 14px;
}
.tt {
  font-size: 13px;
}
.dim {
  color: var(--text-disabled);
  font-size: 11px;
  margin-top: 2px;
}
.win {
  color: var(--accent-jade);
}
.lose {
  color: var(--accent-crimson);
}
.empty {
  color: var(--text-disabled);
  text-align: center;
  padding: 16px;
}
</style>
