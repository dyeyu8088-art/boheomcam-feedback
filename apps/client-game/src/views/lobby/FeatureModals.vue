<template>
  <div>
    <!-- 排行榜 -->
    <ModalSheet v-model="showRank" :title="t('rank.title')" width="460px">
      <div class="tabs">
        <button v-for="b in boards" :key="b.key" :class="{ on: board === b.key }" @click="loadRank(b.key)">{{ t(b.label) }}</button>
      </div>
      <div class="ranklist">
        <div v-for="it in rankItems" :key="it.rank" class="rrow" :class="{ top3: it.rank <= 3 }">
          <span class="rk num">{{ ['🥇', '🥈', '🥉'][it.rank - 1] ?? it.rank }}</span>
          <span class="rn">{{ avatarEmoji(it.avatar_id ?? 1) }} {{ it.nickname ?? it.uid }}</span>
          <span class="rv num">{{ fmt(it.value) }}</span>
        </div>
        <div v-if="rankItems.length === 0" class="empty">{{ t('common.empty') }}</div>
      </div>
    </ModalSheet>

    <!-- 邮件 -->
    <ModalSheet v-model="showMail" :title="t('mail.title')" width="460px">
      <div v-if="mails.length === 0" class="empty">{{ t('common.empty') }}</div>
      <div v-for="m in mails" :key="m.mail_id" class="mail" :class="{ unread: !m.read_at }">
        <div class="mhead" @click="readMail(m)">
          <span class="mtitle">{{ m.title }}</span>
          <span class="mtime">{{ fmtTime(m.created_at) }}</span>
        </div>
        <div v-if="expanded === m.mail_id" class="mbody">
          {{ m.body }}
          <button
            v-if="m.attachments.length && !m.claimed_at"
            class="btn btn-primary btn-sm"
            style="margin-top: 10px"
            @click="claimMail(m)"
          >
            {{ t('mail.claim') }} ({{ m.attachments.map((a: any) => `${a.currency === 'COIN' ? '◉' : '◆'}${fmt(a.amount)}`).join(' ') }})
          </button>
          <div v-else-if="m.claimed_at" class="dim">{{ t('mail.claimed') }}</div>
        </div>
      </div>
    </ModalSheet>

    <!-- 公告 -->
    <ModalSheet v-model="showAnnounce" :title="t('feature.announce')" width="460px">
      <div v-for="a in announcements" :key="a.id" class="ann">
        <div class="atitle">{{ locale === 'ko' && a.title_ko ? a.title_ko : a.title }}</div>
        <div class="abody">{{ locale === 'ko' && a.body_ko ? a.body_ko : a.body }}</div>
      </div>
      <div v-if="announcements.length === 0" class="empty">{{ t('common.empty') }}</div>
    </ModalSheet>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import ModalSheet from '../../ui/ModalSheet.vue';
import { toast } from '../../ui/toast.js';
import { avatarEmoji, fmt, fmtTime } from '../../ui/format.js';
import { useUserStore } from '../../stores/user.js';

const locale = currentLocale;
const user = useUserStore();
const showRank = ref(false);
const showMail = ref(false);
const showAnnounce = ref(false);
const board = ref('coins');
const boards = [
  { key: 'coins', label: 'rank.coins' },
  { key: 'wins_daily', label: 'rank.wins' },
  { key: 'fish_daily', label: 'rank.fish' },
];
const rankItems = ref<{ rank: number; uid: number; nickname?: string; avatar_id?: number; value: number }[]>([]);
const mails = ref<any[]>([]);
const announcements = ref<any[]>([]);
const expanded = ref<number | null>(null);

async function loadRank(b: string): Promise<void> {
  board.value = b;
  try {
    rankItems.value = (await api<{ items: typeof rankItems.value }>(`/api/v1/rankings/${b}`)).items;
  } catch {
    rankItems.value = [];
  }
}

async function open(key: string): Promise<void> {
  if (key === 'rank') {
    showRank.value = true;
    await loadRank('coins');
  } else if (key === 'mail') {
    showMail.value = true;
    mails.value = (await api<{ items: any[] }>('/api/v1/mail')).items;
  } else if (key === 'announce') {
    showAnnounce.value = true;
    announcements.value = (await api<{ items: any[] }>('/api/v1/announcements')).items;
  }
}
defineExpose({ open });

async function readMail(m: any): Promise<void> {
  expanded.value = expanded.value === m.mail_id ? null : m.mail_id;
  if (!m.read_at) {
    m.read_at = new Date().toISOString();
    await api(`/api/v1/mail/${m.mail_id}/read`, {}).catch(() => undefined);
  }
}

async function claimMail(m: any): Promise<void> {
  try {
    await api(`/api/v1/mail/${m.mail_id}/claim`, {});
    m.claimed_at = new Date().toISOString();
    await user.loadMe();
    toast('✓', 'success');
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tabs button {
  flex: 1;
  padding: 8px 0;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg-night);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
}
.tabs button.on {
  color: var(--gold-champagne);
  border-color: var(--gold-warm);
}
.rrow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(154, 163, 178, 0.08);
  font-size: 14px;
}
.rrow.top3 {
  background: linear-gradient(90deg, rgba(201, 160, 99, 0.07), transparent);
}
.rk {
  width: 32px;
  text-align: center;
}
.rn {
  flex: 1;
}
.rv {
  color: var(--gold-champagne);
  font-weight: 700;
}
.mail {
  border-bottom: 1px solid rgba(154, 163, 178, 0.08);
  padding: 10px 0;
}
.mhead {
  display: flex;
  justify-content: space-between;
  cursor: pointer;
}
.mail.unread .mtitle {
  color: var(--gold-champagne);
  font-weight: 700;
}
.mtime {
  font-size: 11px;
  color: var(--text-disabled);
}
.mbody {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.ann {
  padding: 10px 0;
  border-bottom: 1px solid rgba(154, 163, 178, 0.08);
}
.atitle {
  font-weight: 700;
  color: var(--gold-champagne);
  margin-bottom: 6px;
}
.abody {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}
.empty {
  color: var(--text-disabled);
  text-align: center;
  padding: 24px;
}
.dim {
  color: var(--text-disabled);
  font-size: 12px;
  margin-top: 8px;
}
</style>
