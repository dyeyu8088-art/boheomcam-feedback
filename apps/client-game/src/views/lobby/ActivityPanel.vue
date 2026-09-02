<template>
  <div class="panel">
    <!-- 签到 -->
    <section class="glass sec">
      <div class="sec-head">
        <h4>{{ t('signin.title') }}</h4>
        <span class="streak">{{ t('signin.streak', { n: signin?.streak ?? 0 }) }}</span>
      </div>
      <div class="sign-grid">
        <div
          v-for="r in signin?.rewards ?? []"
          :key="r.day"
          class="sign-cell"
          :class="{ done: (signin?.streak ?? 0) >= r.day, next: !signin?.todaySigned && (signin?.streak ?? 0) + 1 === r.day }"
        >
          <div class="d">{{ t('signin.day', { n: r.day }) }}</div>
          <div class="r"><AppIcon :name="r.currency === 'COIN' ? 'coin' : 'gem'" :size="13" />{{ fmt(r.amount) }}</div>
        </div>
      </div>
      <button class="btn btn-primary wide" :disabled="signin?.todaySigned || busy" @click="doSign">
        {{ signin?.todaySigned ? t('signin.done') : t('signin.do') }}
      </button>
    </section>

    <!-- 任务 -->
    <section class="glass sec">
      <div class="sec-head">
        <h4>{{ t('tasks.title') }}</h4>
      </div>
      <EmptyState v-if="tasks.length === 0" :title="t('common.empty')" />
      <div v-for="task in tasks" :key="task.taskId" class="task">
        <div class="tinfo">
          <div class="tname">{{ locale === 'ko' && task.nameKo ? task.nameKo : task.name }}</div>
          <div class="tbar">
            <div class="tfill" :style="{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }" />
          </div>
          <div class="tprog num">{{ task.progress }}/{{ task.target }}</div>
        </div>
        <div class="treward num">{{ task.rewards.map((r: any) => `${fmt(r.amount)} ${r.currency === 'COIN' ? '金币' : '钻石'}`).join(' · ') }}</div>
        <button
          class="btn btn-sm"
          :class="task.completed && !task.claimed ? 'btn-primary' : 'btn-ghost'"
          :disabled="!task.completed || task.claimed"
          @click="claim(task)"
        >
          {{ task.claimed ? t('tasks.claimed') : t('tasks.claim') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import AppIcon from '../../ui/AppIcon.vue';
import { fmt } from '../../ui/format.js';
import { useUserStore } from '../../stores/user.js';
import EmptyState from '../../ui/EmptyState.vue';

interface SignData {
  todaySigned: boolean;
  streak: number;
  rewards: { day: number; currency: string; amount: number }[];
}
interface TaskData {
  taskId: string;
  name: string;
  nameKo: string;
  target: number;
  progress: number;
  rewards: { currency: string; amount: number }[];
  completed: boolean;
  claimed: boolean;
}

const locale = currentLocale;
const user = useUserStore();
const signin = ref<SignData | null>(null);
const tasks = ref<TaskData[]>([]);
const busy = ref(false);

async function load(): Promise<void> {
  try {
    signin.value = await api<SignData>('/api/v1/activity/signin');
    tasks.value = (await api<{ items: TaskData[] }>('/api/v1/activity/tasks')).items;
  } catch {
    /* noop */
  }
}
onMounted(load);
onActivated(load);

async function doSign(): Promise<void> {
  busy.value = true;
  try {
    const r = await api<{ streak: number; reward: { currency: string; amount: number }; balanceAfter: number }>(
      '/api/v1/activity/signin',
      {},
    );
    toast(`+${fmt(r.reward.amount)} ${r.reward.currency === 'COIN' ? '金币' : '钻石'}`, 'success');
    if (r.reward.currency === 'COIN') user.setBalance(r.balanceAfter);
    await load();
    await user.loadMe();
  } catch (e) {
    toast((e as Error).message, 'error');
  } finally {
    busy.value = false;
  }
}

async function claim(task: TaskData): Promise<void> {
  try {
    await api(`/api/v1/activity/tasks/${task.taskId}/claim`, {});
    toast(t('tasks.claimed'), 'success');
    await load();
    await user.loadMe();
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}
</script>

<style scoped>
/*
  面板宽度：flex 子项上的 `margin: 0 auto` 会取消 align-items:stretch，
  导致面板塌成内容宽度（1920 下只有 341px）。必须显式给 width:100%。
*/
.panel {
  display: grid;
  gap: 18px;
  width: 100%;
  max-width: min(1180px, 92vw);
  margin-inline: auto;
  align-content: start;
}
@media (min-width: 1024px) {
  .panel {
    /* 桌面：签到与任务并排，消除中央窄条 */
    grid-template-columns: 1fr 1.12fr;
    align-items: start;
    gap: 22px;
  }
}
.sec {
  padding: 20px 22px 22px;
  border-radius: var(--radius-card);
  box-shadow:
    var(--edge-inner),
    var(--shadow-card);
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
h4 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: linear-gradient(180deg, #fff8e6 6%, #e6cfa3 56%, #b3924f 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.streak {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ══ 签到 ══ */
.sign-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 18px;
}
.sign-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 84px;
  padding: 10px 4px;
  text-align: center;
  border-radius: 12px;
  background: linear-gradient(168deg, rgba(23, 34, 58, 0.9), rgba(11, 17, 29, 0.92));
  border: 1px solid var(--line-cool);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    inset 0 -8px 14px rgba(0, 0, 0, 0.3);
  transition:
    border-color 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}
/* 第 7 天为周奖励，视觉权重最高 */
.sign-cell:last-child {
  background: linear-gradient(168deg, rgba(46, 36, 18, 0.92), rgba(20, 15, 8, 0.94));
  border-color: rgba(201, 160, 99, 0.34);
}
.sign-cell.done {
  border-color: rgba(75, 179, 156, 0.45);
}
.sign-cell.done::after {
  content: '';
  position: absolute;
  top: 7px;
  right: 8px;
  width: 11px;
  height: 6px;
  border-left: 2px solid var(--accent-jade);
  border-bottom: 2px solid var(--accent-jade);
  transform: rotate(-45deg);
}
.sign-cell.done .r,
.sign-cell.done .d {
  opacity: 0.5;
}
.sign-cell.next {
  border-color: rgba(201, 160, 99, 0.75);
  transform: translateY(-3px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 8px 20px rgba(0, 0, 0, 0.42),
    0 0 20px rgba(201, 160, 99, 0.24);
}
.d {
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}
.r {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 700;
  color: var(--gold-champagne);
}
.wide {
  width: 100%;
  padding: 13px 22px;
}

/* ══ 任务 ══ */
.task {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
  border-top: 1px solid rgba(154, 163, 178, 0.08);
}
.task:first-of-type {
  border-top: none;
}
.tinfo {
  flex: 1;
  min-width: 0;
}
.tname {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-strong);
}
.tbar {
  position: relative;
  height: 6px;
  background: rgba(6, 10, 18, 0.85);
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.55);
}
.tfill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold-deep), var(--gold-warm) 60%, var(--gold-pale));
  border-radius: 3px;
  box-shadow: 0 0 8px rgba(201, 160, 99, 0.45);
  transition: width 0.4s var(--ease-out);
}
.tprog {
  font-size: 11px;
  color: var(--text-disabled);
  margin-top: 5px;
}
.treward {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--gold-champagne);
  white-space: nowrap;
}
.empty {
  color: var(--text-disabled);
  text-align: center;
  padding: 24px;
}
</style>
