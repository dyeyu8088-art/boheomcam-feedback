<template>
  <el-card shadow="never">
    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="实时房间" name="rooms">
        <el-table v-loading="loading" :data="rooms" size="small">
          <el-table-column prop="room_id" label="房间ID" width="170" />
          <el-table-column prop="room_no" label="房间号" width="90" />
          <el-table-column prop="game_id" label="游戏" width="140" />
          <el-table-column prop="stage_id" label="场次" width="130" />
          <el-table-column prop="mode" label="模式" width="80" />
          <el-table-column prop="players" label="人数" width="70" />
          <el-table-column prop="state" label="状态" width="90" />
          <el-table-column prop="server_node" label="节点" width="110" />
          <el-table-column label="创建时间">
            <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="对局记录" name="rounds">
        <div class="bar">
          <el-select v-model="gameId" placeholder="游戏" clearable style="width: 180px">
            <el-option value="mahjong_yanbian" label="延边麻将" />
            <el-option value="hongshi" label="红十" />
          </el-select>
          <el-input v-model="uid" placeholder="按 UID 筛选" style="width: 160px" clearable />
          <el-button type="primary" @click="load">查询</el-button>
        </div>
        <el-table v-loading="loading" :data="rounds" size="small">
          <el-table-column prop="round_id" label="Round" width="170" />
          <el-table-column prop="room_id" label="房间" width="170" />
          <el-table-column prop="game_id" label="游戏" width="140" />
          <el-table-column prop="rule_version" label="规则版本" width="170" />
          <el-table-column prop="score_change" label="输赢(按UID查询时)" width="130" />
          <el-table-column label="开始时间">
            <template #default="{ row }">{{ new Date(row.started_at ?? row.created_at).toLocaleString() }}</template>
          </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="page" layout="prev, pager, next" :page-count="page + (rounds.length === 50 ? 1 : 0)" @current-change="load" style="margin-top: 12px" />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api.js';

const tab = ref('rooms');
const rooms = ref<any[]>([]);
const rounds = ref<any[]>([]);
const gameId = ref('');
const uid = ref('');
const page = ref(1);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    if (tab.value === 'rooms') {
      rooms.value = (await api<{ items: any[] }>('/api/admin/v1/rooms')).items;
    } else {
      const q = new URLSearchParams({ page: String(page.value) });
      if (gameId.value) q.set('gameId', gameId.value);
      if (uid.value) q.set('uid', uid.value);
      rounds.value = (await api<{ items: any[] }>(`/api/admin/v1/rounds?${q}`)).items;
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
