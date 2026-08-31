<template>
  <el-card shadow="never">
    <div class="bar">
      <el-input v-model="adminId" placeholder="按管理员ID" style="width: 160px" clearable />
      <el-input v-model="action" placeholder="按动作前缀 (如 wallet.)" style="width: 220px" clearable />
      <el-button type="primary" @click="load">查询</el-button>
      <el-alert type="warning" :closable="false" style="flex: 1" title="审计日志与账本由数据库触发器保护，任何人（含超管）不可修改或删除。" />
    </div>
    <el-table v-loading="loading" :data="items" size="small">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="admin_id" label="管理员" width="90" />
      <el-table-column prop="action" label="动作" width="180" />
      <el-table-column prop="target" label="目标" width="150" />
      <el-table-column label="变更" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.before ? `前:${JSON.stringify(row.before)} ` : '' }}{{ row.after ? `后:${JSON.stringify(row.after)}` : '' }}
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" width="160" show-overflow-tooltip />
      <el-table-column prop="admin_ip" label="IP" width="130" />
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" layout="prev, pager, next" :page-count="page + (items.length === 50 ? 1 : 0)" @current-change="load" style="margin-top: 12px" />
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api.js';

const adminId = ref('');
const action = ref('');
const page = ref(1);
const items = ref<any[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const q = new URLSearchParams({ page: String(page.value) });
    if (adminId.value) q.set('adminId', adminId.value);
    if (action.value) q.set('action', action.value);
    items.value = (await api<{ items: any[] }>(`/api/admin/v1/audit-logs?${q}`)).items;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<style scoped>
.bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  align-items: center;
}
</style>
