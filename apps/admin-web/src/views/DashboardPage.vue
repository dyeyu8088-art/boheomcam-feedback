<template>
  <div v-loading="loading">
    <el-row :gutter="14">
      <el-col v-for="c in cards" :key="c.label" :span="4">
        <el-card shadow="never" class="stat">
          <div class="v">{{ c.value }}</div>
          <div class="k">{{ c.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14" style="margin-top: 14px">
      <el-col :span="14">
        <el-card shadow="never" header="24小时交易量（笔/时）">
          <div ref="lineEl" style="height: 260px" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" header="各游戏实时在线">
          <div ref="barEl" style="height: 260px" />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" header="服务器节点" style="margin-top: 14px">
      <el-table :data="nodes" size="small">
        <el-table-column prop="node_id" label="节点" />
        <el-table-column prop="kind" label="类型" width="90" />
        <el-table-column prop="roles" label="角色" />
        <el-table-column label="心跳" width="200">
          <template #default="{ row }">
            <el-tag :type="fresh(row.last_heartbeat_at) ? 'success' : 'danger'" size="small">
              {{ new Date(row.last_heartbeat_at).toLocaleTimeString() }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as echarts from 'echarts';
import { api } from '../api.js';

const loading = ref(true);
const cards = ref<{ label: string; value: string | number }[]>([]);
const nodes = ref<Record<string, unknown>[]>([]);
const lineEl = ref<HTMLDivElement | null>(null);
const barEl = ref<HTMLDivElement | null>(null);
let lineChart: echarts.ECharts | null = null;
let barChart: echarts.ECharts | null = null;
let timer = 0;

const GOLD = '#c9a063';
const fresh = (ts: string): boolean => Date.now() - new Date(ts).getTime() < 60000;

async function load(): Promise<void> {
  const d = await api<any>('/api/admin/v1/dashboard');
  cards.value = [
    { label: '注册用户', value: d.totalUsers },
    { label: '今日新增', value: d.todayNewUsers },
    { label: 'DAU', value: d.dau },
    { label: '实时在线', value: d.online },
    { label: '今日金币产出', value: d.coinProducedToday.toLocaleString() },
    { label: '今日金币消耗', value: d.coinConsumedToday.toLocaleString() },
  ];
  nodes.value = d.serverNodes;
  loading.value = false;

  const hours = (d.txPerHour as { h: string; n: number }[]).map((x) => new Date(x.h).getHours() + ':00');
  const counts = (d.txPerHour as { h: string; n: number }[]).map((x) => x.n);
  lineChart?.setOption({
    grid: { left: 44, right: 16, top: 20, bottom: 28 },
    xAxis: { type: 'category', data: hours, axisLine: { lineStyle: { color: '#c8cdd4' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f3' } } },
    tooltip: { trigger: 'axis' },
    series: [{ type: 'line', data: counts, smooth: true, areaStyle: { opacity: 0.12 }, lineStyle: { color: GOLD, width: 2.5 }, itemStyle: { color: GOLD }, symbolSize: 5 }],
  });
  const games = Object.entries(d.onlinePerGame as Record<string, number>);
  barChart?.setOption({
    grid: { left: 90, right: 20, top: 12, bottom: 28 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f3' } } },
    yAxis: { type: 'category', data: games.map(([g]) => ({ mahjong_yanbian: '延边麻将', hongshi: '红十', fishing: '捕鱼', slot_fruit: '黄金水果' })[g] ?? g) },
    tooltip: {},
    series: [{ type: 'bar', data: games.map(([, n]) => n), barWidth: 18, itemStyle: { color: GOLD, borderRadius: [0, 6, 6, 0] } }],
  });
}

onMounted(() => {
  lineChart = echarts.init(lineEl.value!);
  barChart = echarts.init(barEl.value!);
  void load();
  timer = window.setInterval(() => void load(), 15000);
});
onBeforeUnmount(() => {
  window.clearInterval(timer);
  lineChart?.dispose();
  barChart?.dispose();
});
</script>

<style scoped>
.stat {
  text-align: center;
}
.v {
  font-size: 22px;
  font-weight: 800;
  color: #303133;
}
.k {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
