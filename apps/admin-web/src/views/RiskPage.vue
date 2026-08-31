<template>
  <el-card shadow="never">
    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="风控事件" name="events">
        <el-table v-loading="loading" :data="events" size="small">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="user_id" label="UID" width="110" />
          <el-table-column prop="type" label="类型" width="150" />
          <el-table-column label="级别" width="90">
            <template #default="{ row }">
              <el-tag :type="row.severity === 'high' || row.severity === 'critical' ? 'danger' : row.severity === 'medium' ? 'warning' : 'info'" size="small">
                {{ row.severity }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="证据" show-overflow-tooltip>
            <template #default="{ row }">{{ JSON.stringify(row.evidence) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90" />
          <el-table-column v-if="can('risk.handle')" label="操作" width="170">
            <template #default="{ row }">
              <el-button v-if="row.status === 'open'" size="small" type="success" @click="handle(row, 'handled')">处理</el-button>
              <el-button v-if="row.status === 'open'" size="small" @click="handle(row, 'ignored')">忽略</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="封禁列表" name="bans">
        <el-table v-loading="loading" :data="bans" size="small">
          <el-table-column prop="target_type" label="类型" width="80" />
          <el-table-column prop="target" label="目标" width="140" />
          <el-table-column prop="reason" label="原因" show-overflow-tooltip />
          <el-table-column label="到期" width="170">
            <template #default="{ row }">{{ row.until_at ? new Date(row.until_at).toLocaleString() : '永久' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.lifted_at ? 'info' : 'danger'" size="small">{{ row.lifted_at ? '已解除' : '生效中' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="operator_id" label="操作人" width="90" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api, can } from '../api.js';

const tab = ref('events');
const events = ref<any[]>([]);
const bans = ref<any[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    if (tab.value === 'events') events.value = (await api<{ items: any[] }>('/api/admin/v1/risk-events')).items;
    else bans.value = (await api<{ items: any[] }>('/api/admin/v1/bans')).items;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function handle(row: any, action: string): Promise<void> {
  await api(`/api/admin/v1/risk-events/${row.id}/handle`, { action });
  ElMessage.success('已处理');
  await load();
}
</script>
