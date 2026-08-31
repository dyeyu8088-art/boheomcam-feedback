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
          <div class="r">{{ r.currency === 'COIN' ? '◉' : '◆' }}{{ fmt(r.amount) }}</div>
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
      <div v-if="tasks.length === 0" class="empty">{{ t('common.empty') }}</div>
      <div v-for="task in tasks" :key="task.taskId" class="task">
        <div class="tinfo">
          <div class="tname">{{ locale === 'ko' && task.nameKo ? task.nameKo : task.name }}</div>
          <div class="tbar">
            <div class="tfill" :style="{ width: `${Math.min(100, (task.progress / task.target) * 100)}%` }" />
          </div>
          <div class="tprog num">{{ task.progress }}/{{ task.target }}</div>
        </div>
        <div class="treward num">{{ task.rewards.map((r: any) => `${r.currency === 'COIN' ? '◉' : '◆'}${fmt(r.amount)}`).join(' ') }}</div>
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
import { fmt } from '../../ui/format.js';
import { useUserStore } from '../../stores/user.js';

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
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 640px;
  margin: 0 auto;
}
.sec {
  padding: 16px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
h4 {
  margin: 0;
  font-size: 16px;
  color: var(--gold-champagne);
}
.streak {
  font-size: 12px;
  color: var(--text-secondary);
}
.sign-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 14px;
}
.sign-cell {
  background: var(--bg-night);
  border: 1px solid rgba(154, 163, 178, 0.12);
  border-radius: 10px;
  padding: 8px 2px;
  text-align: center;
}
.sign-cell.done {
  border-color: var(--accent-jade);
  opacity: 0.65;
}
.sign-cell.next {
  border-color: var(--gold-warm);
  box-shadow: var(--shadow-glow-gold);
}
.d {
  font-size: 10px;
  color: var(--text-secondary);
}
.r {
  font-size: 11px;
  color: var(--gold-champagne);
  margin-top: 4px;
}
.wide {
  width: 100%;
}
.task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(154, 163, 178, 0.08);
}
.tinfo {
  flex: 1;
}
.tname {
  font-size: 14px;
}
.tbar {
  height: 4px;
  background: var(--bg-night);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}
.tfill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold-deep), var(--gold-warm));
  border-radius: 2px;
  transition: width 0.4s var(--ease-out);
}
.tprog {
  font-size: 10px;
  color: var(--text-disabled);
  margin-top: 3px;
}
.treward {
  font-size: 12px;
  color: var(--gold-champagne);
  white-space: nowrap;
}
.empty {
  color: var(--text-disabled);
  text-align: center;
  padding: 18px;
}
</style>
