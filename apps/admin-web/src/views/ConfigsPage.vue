<template>
  <el-card shadow="never">
    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="游戏状态" name="games">
        <el-table v-loading="loading" :data="games" size="small">
          <el-table-column prop="game_id" label="游戏ID" width="170" />
          <el-table-column prop="name" label="名称" width="130" />
          <el-table-column prop="name_ko" label="한국어" width="130" />
          <el-table-column label="状态" width="130">
            <template #default="{ row }">
              <el-tag :type="row.status === 'online' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="can('game.maintain')" label="操作">
            <template #default="{ row }">
              <el-button v-if="row.status !== 'online'" size="small" type="success" @click="setStatus(row, 'online')">上线</el-button>
              <el-button v-if="row.status === 'online'" size="small" type="warning" @click="setStatus(row, 'maintenance')">维护</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="规则/数值配置" name="configs">
        <el-alert type="info" :closable="false" style="margin-bottom: 12px"
          title="规则包与概率(Paytable/RTP)修改必须填写原因并二次确认，全部进入 config_versions 留痕；水果机新赔付表发布前须附 RTP 模拟报告（scripts/slot-rtp-sim.ts）。" />
        <el-table v-loading="loading" :data="configs" size="small">
          <el-table-column prop="game_id" label="游戏" width="150" />
          <el-table-column prop="config_key" label="配置键" width="120" />
          <el-table-column prop="rule_version" label="版本" width="200" />
          <el-table-column prop="status" label="状态" width="90" />
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button size="small" @click="view(row)">查看</el-button>
              <el-button v-if="can('config.publish')" size="small" type="primary" @click="edit(row)">发布新版</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="修改留痕" name="versions">
        <el-table v-loading="loading" :data="versions" size="small">
          <el-table-column prop="ref_id" label="配置" width="280" />
          <el-table-column prop="admin_id" label="管理员" width="90" />
          <el-table-column prop="reason" label="原因" show-overflow-tooltip />
          <el-table-column prop="admin_ip" label="IP" width="130" />
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="editorOpen" :title="editing ? '发布新配置版本' : '配置内容'" width="720px">
      <el-form v-if="editing" label-width="90px" style="margin-bottom: 8px">
        <el-form-item label="新版本号"><el-input v-model="form.ruleVersion" /></el-form-item>
        <el-form-item label="修改原因"><el-input v-model="form.reason" placeholder="必填，写入 config_versions 与审计日志" /></el-form-item>
      </el-form>
      <el-input v-model="form.configText" type="textarea" :rows="18" :readonly="!editing" style="font-family: monospace" />
      <template #footer v-if="editing">
        <el-button @click="editorOpen = false">取消</el-button>
        <el-button type="primary" @click="publish">二次确认并发布</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api, can } from '../api.js';

const tab = ref('games');
const games = ref<any[]>([]);
const configs = ref<any[]>([]);
const versions = ref<any[]>([]);
const loading = ref(false);
const editorOpen = ref(false);
const editing = ref(false);
const form = ref({ id: 0, gameId: '', configKey: '', ruleVersion: '', reason: '', configText: '' });

async function load(): Promise<void> {
  loading.value = true;
  try {
    if (tab.value === 'games') games.value = (await api<{ items: any[] }>('/api/admin/v1/games')).items;
    else if (tab.value === 'configs') configs.value = (await api<{ items: any[] }>('/api/admin/v1/configs')).items;
    else versions.value = (await api<{ items: any[] }>('/api/admin/v1/config-versions')).items;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function setStatus(row: any, status: string): Promise<void> {
  await ElMessageBox.confirm(`确认将 ${row.name} 切换为 ${status}？`, '二次确认', { type: 'warning' });
  await api(`/api/admin/v1/games/${row.game_id}/status`, { status });
  ElMessage.success('已更新');
  await load();
}

async function view(row: any): Promise<void> {
  const full = await api<any>(`/api/admin/v1/configs/${row.id}`);
  form.value = { id: row.id, gameId: row.game_id, configKey: row.config_key, ruleVersion: row.rule_version, reason: '', configText: JSON.stringify(full.config, null, 2) };
  editing.value = false;
  editorOpen.value = true;
}

async function edit(row: any): Promise<void> {
  await view(row);
  form.value.ruleVersion = `${row.rule_version.replace(/\.draft$/, '')}_r${Date.now() % 10000}`;
  editing.value = true;
}

async function publish(): Promise<void> {
  let config: unknown;
  try {
    config = JSON.parse(form.value.configText);
  } catch {
    ElMessage.error('JSON 格式错误');
    return;
  }
  await ElMessageBox.confirm(`确认发布 ${form.value.gameId}/${form.value.configKey} 新版本 ${form.value.ruleVersion}？`, '二次确认', { type: 'warning' });
  await api('/api/admin/v1/configs', {
    gameId: form.value.gameId,
    configKey: form.value.configKey,
    ruleVersion: form.value.ruleVersion,
    config,
    reason: form.value.reason,
    confirm: true,
  });
  ElMessage.success('已发布并留痕');
  editorOpen.value = false;
  await load();
}
</script>
