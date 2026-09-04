<template>
  <GamePopup :model-value="modelValue" :title="t('support.title')" skin="blue" size="md" @update:model-value="$emit('update:modelValue', $event)">
    <!-- 列表 -->
    <div v-if="view === 'list'" class="sp">
      <p class="hint">{{ t('support.hint') }}</p>
      <div v-if="loading" class="state" role="status">{{ t('common.loading') }}</div>
      <div v-else-if="error" class="state err" role="alert">
        {{ error }}
        <GameButton size="sm" variant="dark" @click="loadList">{{ t('common.retry') }}</GameButton>
      </div>
      <EmptyState v-else-if="tickets.length === 0" :title="t('support.empty')" :hint="t('support.emptyHint')" />
      <ul v-else class="list" role="list">
        <li v-for="tk in tickets" :key="tk.id">
          <button class="row" type="button" :aria-label="`${tk.subject} · ${statusText(tk.status)}`" @click="openTicket(tk.id)">
            <span class="badge" :class="tk.status">{{ statusText(tk.status) }}</span>
            <span class="subject">{{ tk.subject }}</span>
            <span class="time num">{{ fmtTime(tk.last_reply_at) }}</span>
          </button>
        </li>
      </ul>
    </div>

    <!-- 新建 -->
    <form v-else-if="view === 'new'" class="sp form" @submit.prevent="submit">
      <label class="lbl" for="sp-cat">{{ t('support.category') }}</label>
      <div id="sp-cat" class="cats" role="radiogroup" :aria-label="t('support.category')">
        <button v-for="c in CATS" :key="c" type="button" class="cat" :class="{ on: category === c }" role="radio" :aria-checked="category === c" @click="category = c">{{ t(`support.cat.${c}`) }}</button>
      </div>
      <label class="lbl" for="sp-subject">{{ t('support.subject') }}</label>
      <input id="sp-subject" v-model="subject" class="input" maxlength="60" required :placeholder="t('support.subject.placeholder')" />
      <label class="lbl" for="sp-body">{{ t('support.body') }}</label>
      <textarea id="sp-body" v-model="body" class="input area" maxlength="2000" rows="5" required :placeholder="t('support.body.placeholder')" />
      <div v-if="error" class="state err" role="alert">{{ error }}</div>
    </form>

    <!-- 详情 -->
    <div v-else class="sp">
      <div v-if="loading || !cur" class="state" role="status">{{ t('common.loading') }}</div>
      <template v-else>
        <div class="head">
          <span class="badge" :class="cur.status">{{ statusText(cur.status) }}</span>
          <strong class="subject">{{ cur.subject }}</strong>
        </div>
        <div ref="threadEl" class="thread" role="log" :aria-label="t('support.title')">
          <div v-for="m in cur.messages" :key="m.id" class="msg" :class="m.sender">
            <span class="who">{{ m.sender === 'admin' ? t('support.agent') : t('support.me') }} · {{ fmtTime(m.created_at) }}</span>
            <p class="body">{{ m.body }}</p>
          </div>
        </div>
        <form v-if="cur.status !== 'closed'" class="replybox" @submit.prevent="reply">
          <input v-model="replyText" class="input" maxlength="2000" :placeholder="t('support.reply.placeholder')" :aria-label="t('support.reply')" />
          <GameButton size="sm" variant="gold" :disabled="!replyText.trim() || busy" @click="reply">{{ t('support.reply') }}</GameButton>
        </form>
        <div v-else class="state">{{ t('support.closed') }}</div>
        <div v-if="error" class="state err" role="alert">{{ error }}</div>
      </template>
    </div>

    <template #footer>
      <template v-if="view === 'list'">
        <GameButton variant="gold" size="md" sfx="confirm" @click="startNew">{{ t('support.new') }}</GameButton>
      </template>
      <template v-else-if="view === 'new'">
        <GameButton variant="dark" size="md" @click="view = 'list'">{{ t('support.back') }}</GameButton>
        <GameButton variant="gold" size="md" sfx="confirm" :disabled="busy || subject.trim().length < 2 || body.trim().length < 2" @click="submit">{{ t('support.submit') }}</GameButton>
      </template>
      <template v-else>
        <GameButton variant="dark" size="md" @click="backToList">{{ t('support.back') }}</GameButton>
        <GameButton v-if="cur && cur.status !== 'closed'" variant="red" size="md" :disabled="busy" @click="closeTicket">{{ t('support.close') }}</GameButton>
      </template>
    </template>
  </GamePopup>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { api } from '../../net/api.js';
import { t } from '../../i18n/index.js';
import { fmtTime } from '../../ui/format.js';
import { toast } from '../../ui/toast.js';
import GamePopup from '../../ui/GamePopup.vue';
import GameButton from '../../ui/GameButton.vue';
import EmptyState from '../../ui/EmptyState.vue';

/** 客服工单：真实后端（/api/v1/support/*），列表 / 新建 / 往来记录 / 追加留言 / 关闭；后台客服回复后状态变为「已回复」 */
interface TicketRow {
  id: number;
  category: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  last_reply_by: 'user' | 'admin';
  last_reply_at: string;
}
interface Ticket extends TicketRow {
  messages: { id: number; sender: 'user' | 'admin'; body: string; created_at: string }[];
}
const props = defineProps<{ modelValue: boolean }>();
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const CATS = ['account', 'coins', 'game', 'bug', 'suggest', 'other'] as const;
const view = ref<'list' | 'new' | 'detail'>('list');
const tickets = ref<TicketRow[]>([]);
const cur = ref<Ticket | null>(null);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const category = ref<(typeof CATS)[number]>('other');
const subject = ref('');
const body = ref('');
const replyText = ref('');
const threadEl = ref<HTMLElement | null>(null);

const statusText = (s: string): string => t(`support.status.${s}`);
function errText(e: unknown): string {
  const err = e as { code?: number; message?: string } | undefined;
  if (err?.code === 1003) return t('error.RATE_LIMITED');
  if (err?.code === 1004) return t('error.VALIDATION');
  if (err?.message && err.message !== 'Failed to fetch') return err.message;
  return err?.message === 'Failed to fetch' ? t('error.network') : t('error.generic');
}

async function loadList(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    tickets.value = (await api<{ items: TicketRow[] }>('/api/v1/support/tickets')).items;
  } catch (e) {
    error.value = errText(e);
  } finally {
    loading.value = false;
  }
}
async function openTicket(id: number): Promise<void> {
  view.value = 'detail';
  loading.value = true;
  error.value = '';
  try {
    cur.value = await api<Ticket>(`/api/v1/support/tickets/${id}`);
    await nextTick();
    threadEl.value?.scrollTo({ top: threadEl.value.scrollHeight });
  } catch (e) {
    error.value = errText(e);
  } finally {
    loading.value = false;
  }
}
function startNew(): void {
  error.value = '';
  view.value = 'new';
}
async function submit(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const r = await api<{ ticketId: number }>('/api/v1/support/tickets', { category: category.value, subject: subject.value.trim(), body: body.value.trim() });
    subject.value = '';
    body.value = '';
    toast(t('support.submitted'), 'success');
    await loadList();
    await openTicket(r.ticketId);
  } catch (e) {
    error.value = errText(e);
  } finally {
    busy.value = false;
  }
}
async function reply(): Promise<void> {
  if (!cur.value || !replyText.value.trim() || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api(`/api/v1/support/tickets/${cur.value.id}/messages`, { body: replyText.value.trim() });
    replyText.value = '';
    await openTicket(cur.value.id);
  } catch (e) {
    error.value = errText(e);
  } finally {
    busy.value = false;
  }
}
async function closeTicket(): Promise<void> {
  if (!cur.value || busy.value) return;
  busy.value = true;
  try {
    await api(`/api/v1/support/tickets/${cur.value.id}/close`, {});
    toast(t('support.closed'), 'info');
    await openTicket(cur.value.id);
    await loadList();
  } catch (e) {
    error.value = errText(e);
  } finally {
    busy.value = false;
  }
}
async function backToList(): Promise<void> {
  view.value = 'list';
  await loadList();
}
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      view.value = 'list';
      void loadList();
    }
  },
);
</script>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 200px;
}
.hint {
  margin: 0;
  font-size: 12px;
  color: #9fb4e8;
}
.state {
  padding: 14px;
  text-align: center;
  color: #c7d3ee;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.state.err {
  color: #ffb3a8;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(48vh, 420px);
  overflow-y: auto;
}
.row {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(201, 160, 99, 0.22);
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 120ms var(--ease-out);
}
.row:hover {
  background: rgba(255, 255, 255, 0.1);
}
.row:active {
  transform: scale(0.985);
}
.badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  background: #6b5218;
  color: #ffe9a8;
}
.badge.open {
  background: #7a2f1f;
  color: #ffd0c4;
}
.badge.answered {
  background: #1f6b46;
  color: #c9ffe1;
}
.badge.closed {
  background: #3a4358;
  color: #c4cee6;
}
.subject {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.time {
  font-size: 11px;
  color: #9fb4e8;
}
.form {
  gap: 6px;
}
.lbl {
  font-size: 12px;
  color: #c9d6f2;
  margin-top: 4px;
}
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cat {
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #dfe6f7;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(201, 160, 99, 0.25);
}
.cat.on {
  background: linear-gradient(180deg, #ffe08a, #d9a13a);
  color: #3a2200;
  font-weight: 800;
}
.input {
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  box-shadow: inset 0 0 0 1px rgba(201, 160, 99, 0.3);
  color: #fff;
  font: inherit;
  font-size: 14px;
}
.input:focus-visible {
  outline: 2px solid #f0c14e;
}
.area {
  resize: vertical;
  min-height: 90px;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.thread {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(42vh, 360px);
  overflow-y: auto;
  padding: 4px 2px;
}
.msg {
  max-width: 88%;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.07);
  align-self: flex-end;
}
.msg.admin {
  align-self: flex-start;
  background: rgba(201, 160, 99, 0.18);
}
.who {
  display: block;
  font-size: 11px;
  color: #9fb4e8;
  margin-bottom: 3px;
}
.body {
  margin: 0;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.replybox {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
