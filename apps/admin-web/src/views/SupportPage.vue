<template>
  <el-card shadow="never">
    <template #header>
      <div class="hd">
        <span>客服工单</span>
        <div class="filters">
          <el-radio-group v-model="status" size="small" @change="load(1)">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="open">待处理</el-radio-button>
            <el-radio-button value="answered">已回复</el-radio-button>
            <el-radio-button value="closed">已关闭</el-radio-button>
          </el-radio-group>
          <el-input v-model="uid" placeholder="按 UID 过滤" clearable size="small" style="width: 160px" @change="load(1)" />
          <el-button size="small" @click="load(page)">刷新</el-button>
        </div>
      </div>
    </template>
    <el-table :data="items" size="small" @row-click="openTicket">
      <el-table-column prop="id" label="#" width="70" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }"><el-tag :type="tagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag></template>
      </el-table-column>
      <el-table-column label="分类" width="90"><template #default="{ row }">{{ catText(row.category) }}</template></el-table-column>
      <el-table-column prop="subject" label="标题" min-width="220" show-overflow-tooltip />
      <el-table-column label="玩家" width="200"><template #default="{ row }">{{ row.nickname ?? '—' }} <span class="dim">UID {{ row.user_id }}</span></template></el-table-column>
      <el-table-column label="最后回复" width="170"><template #default="{ row }">{{ row.last_reply_by === 'admin' ? '客服' : '玩家' }} · {{ fmtTime(row.last_reply_at) }}</template></el-table-column>
      <el-table-column label="创建" width="160"><template #default="{ row }">{{ fmtTime(row.created_at) }}</template></el-table-column>
    </el-table>
    <el-pagination class="pager" layout="prev, pager, next, total" :total="total" :page-size="size" :current-page="page" @current-change="load" />

    <el-drawer v-model="show" :title="cur ? `工单 #${cur.id} · ${cur.subject}` : ''" size="520px">
      <template v-if="cur">
        <div class="meta">
          <el-tag :type="tagType(cur.status)" size="small">{{ statusText(cur.status) }}</el-tag>
          <span>{{ catText(cur.category) }}</span>
          <span>{{ cur.nickname ?? '—' }} · UID {{ cur.user_id }}</span>
          <span>{{ fmtTime(cur.created_at) }}</span>
        </div>
        <div class="thread">
          <div v-for="m in cur.messages" :key="m.id" class="msg" :class="m.sender">
            <div class="who">{{ m.sender === 'admin' ? '客服' : '玩家' }} · {{ fmtTime(m.created_at) }}</div>
            <div class="body">{{ m.body }}</div>
          </div>
        </div>
        <el-input v-model="reply" type="textarea" :rows="4" maxlength="2000" show-word-limit placeholder="回复内容（玩家在大厅「客服」中可见）" :disabled="cur.status === 'closed'" />
        <div class="actions">
          <el-button type="primary" :disabled="cur.status === 'closed' || !reply.trim()" @click="sendReply">回复</el-button>
          <el-button v-if="cur.status !== 'closed'" type="danger" plain @click="closeTicket">关闭工单</el-button>
        </div>
      </template>
    </el-drawer>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api.js';

interface Ticket {
  id: number;
  user_id: number;
  nickname?: string;
  category: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  last_reply_by: 'user' | 'admin';
  last_reply_at: string;
  created_at: string;
  messages?: { id: number; sender: 'user' | 'admin'; body: string; created_at: string }[];
}
const items = ref<Ticket[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(30);
const status = ref('');
const uid = ref('');
const show = ref(false);
const cur = ref<Ticket | null>(null);
const reply = ref('');

const CATS: Record<string, string> = { account: '账号', coins: '资产', game: '对局', bug: '故障', suggest: '建议', other: '其它' };
const STATUS: Record<string, string> = { open: '待处理', answered: '已回复', closed: '已关闭' };
const catText = (c: string): string => CATS[c] ?? c;
const statusText = (s: string): string => STATUS[s] ?? s;
const tagType = (s: string): 'danger' | 'success' | 'info' => (s === 'open' ? 'danger' : s === 'answered' ? 'success' : 'info');
const fmtTime = (s: string): string => new Date(s).toLocaleString('zh-CN', { hour12: false });

async function load(p = 1): Promise<void> {
  page.value = p;
  const qs = new URLSearchParams({ page: String(p) });
  if (status.value) qs.set('status', status.value);
  if (uid.value.trim()) qs.set('uid', uid.value.trim());
  const d = await api<{ items: Ticket[]; total: number; size: number }>(`/api/admin/v1/support/tickets?${qs}`);
  items.value = d.items;
  total.value = d.total;
  size.value = d.size;
}
async function openTicket(row: Ticket): Promise<void> {
  cur.value = await api<Ticket>(`/api/admin/v1/support/tickets/${row.id}`);
  reply.value = '';
  show.value = true;
}
async function sendReply(): Promise<void> {
  if (!cur.value) return;
  await api(`/api/admin/v1/support/tickets/${cur.value.id}/reply`, { body: reply.value.trim() });
  ElMessage.success('已回复');
  await openTicket(cur.value);
  await load(page.value);
}
async function closeTicket(): Promise<void> {
  if (!cur.value) return;
  const { value } = await ElMessageBox.prompt('关闭原因（写入审计日志）', '二次确认：关闭工单', { inputPlaceholder: '例如：问题已解决', confirmButtonText: '关闭工单', cancelButtonText: '取消' });
  await api(`/api/admin/v1/support/tickets/${cur.value.id}/close`, { reason: value ?? '' });
  ElMessage.success('工单已关闭');
  await openTicket(cur.value);
  await load(page.value);
}
onMounted(() => void load(1));
</script>

<style scoped>
.hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.filters {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
.dim {
  color: #909399;
  font-size: 12px;
}
.meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  color: #606266;
  font-size: 13px;
  margin-bottom: 12px;
}
.thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 50vh;
  overflow: auto;
  padding: 4px 0 12px;
}
.msg {
  padding: 8px 12px;
  border-radius: 8px;
  background: #f4f4f5;
  max-width: 92%;
  align-self: flex-start;
}
.msg.admin {
  background: #ecf5ff;
  align-self: flex-end;
}
.who {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.body {
  white-space: pre-wrap;
  word-break: break-word;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
</style>
