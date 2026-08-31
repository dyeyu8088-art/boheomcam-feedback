<template>
  <el-card shadow="never">
    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="交易流水" name="tx">
        <div class="bar">
          <el-input v-model="uid" placeholder="按 UID 筛选" style="width: 180px" clearable />
          <el-select v-model="type" placeholder="类型" style="width: 200px" clearable>
            <el-option v-for="tp in types" :key="tp" :value="tp" :label="tp" />
          </el-select>
          <el-button type="primary" @click="load">查询</el-button>
        </div>
        <el-table v-loading="loading" :data="txs" size="small">
          <el-table-column prop="transaction_id" label="交易ID" width="170" />
          <el-table-column prop="user_id" label="UID" width="110" />
          <el-table-column prop="currency" label="币种" width="80" />
          <el-table-column prop="type" label="类型" width="150" />
          <el-table-column label="金额" width="110">
            <template #default="{ row }">
              <span :style="{ color: row.amount > 0 ? '#67c23a' : '#f56c6c' }">{{ Number(row.amount).toLocaleString() }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="balance_before" label="变动前" width="110" />
          <el-table-column prop="balance_after" label="变动后" width="110" />
          <el-table-column prop="round_id" label="Round" width="170" />
          <el-table-column label="时间" width="160">
            <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="description" label="说明" show-overflow-tooltip />
        </el-table>
        <el-pagination v-model:current-page="page" layout="prev, pager, next" :page-count="page + (txs.length === 50 ? 1 : 0)" @current-change="load" style="margin-top: 12px" />
      </el-tab-pane>

      <el-tab-pane label="结算单" name="settle">
        <el-table v-loading="loading" :data="settles" size="small">
          <el-table-column prop="settlement_id" label="结算ID" width="170" />
          <el-table-column prop="round_id" label="Round" width="170" />
          <el-table-column prop="game_id" label="游戏" width="140" />
          <el-table-column prop="settle_type" label="类型" width="100" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'posted' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="error" label="错误" show-overflow-tooltip />
          <el-table-column label="时间" width="160">
            <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api.js';

const tab = ref('tx');
const uid = ref('');
const type = ref('');
const page = ref(1);
const txs = ref<any[]>([]);
const settles = ref<any[]>([]);
const loading = ref(false);
const types = ['GAME_BET', 'GAME_WIN', 'GAME_LOSS', 'INIT_GRANT', 'SIGNIN_REWARD', 'TASK_REWARD', 'MAIL_REWARD', 'ADMIN_ADJUSTMENT'];

async function load(): Promise<void> {
  loading.value = true;
  try {
    if (tab.value === 'tx') {
      const q = new URLSearchParams({ page: String(page.value) });
      if (uid.value) q.set('uid', uid.value);
      if (type.value) q.set('type', type.value);
      txs.value = (await api<{ items: any[] }>(`/api/admin/v1/wallet/transactions?${q}`)).items;
    } else {
      settles.value = (await api<{ items: any[] }>('/api/admin/v1/wallet/settlements')).items;
    }
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
}
</style>
