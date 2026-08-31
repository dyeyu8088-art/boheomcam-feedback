<template>
  <div>
    <el-card shadow="never">
      <div class="bar">
        <el-input v-model="search" placeholder="UID / 手机号 / 昵称" style="width: 280px" clearable @keyup.enter="load" />
        <el-button type="primary" @click="load">搜索</el-button>
      </div>
      <el-table v-loading="loading" :data="items" size="small" @row-click="openDetail">
        <el-table-column prop="id" label="UID" width="110" />
        <el-table-column prop="nickname" label="昵称" width="140" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="金币" width="120">
          <template #default="{ row }">{{ Number(row.coins).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="level" label="等级" width="70" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'normal' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="170">
          <template #default="{ row }">{{ row.last_login_at ? new Date(row.last_login_at).toLocaleString() : '—' }}</template>
        </el-table-column>
        <el-table-column prop="last_login_ip" label="登录IP" />
      </el-table>
      <el-pagination v-model:current-page="page" layout="prev, pager, next" :page-count="page + (items.length === 20 ? 1 : 0)" @current-change="load" style="margin-top: 12px" />
    </el-card>

    <el-drawer v-model="showDetail" size="640px" :title="`用户 ${detail?.user?.id ?? ''}`">
      <div v-if="detail" class="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="昵称">{{ detail.user.nickname }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.user.status }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ new Date(detail.user.created_at).toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="注册IP">{{ detail.user.created_ip ?? '—' }}</el-descriptions-item>
          <el-descriptions-item v-for="b in detail.balances" :key="b.currency" :label="b.currency">
            {{ Number(b.balance).toLocaleString() }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="acts">
          <el-button v-if="can('wallet.adjust')" type="warning" size="small" @click="adjustOpen = true">调整资产</el-button>
          <el-button v-if="can('user.kick')" size="small" @click="kick">强制下线</el-button>
          <el-button v-if="can('user.ban') && detail.user.status === 'normal'" type="danger" size="small" @click="banOpen = true">封禁</el-button>
          <el-button v-if="can('user.ban') && detail.user.status !== 'normal'" type="success" size="small" @click="unban">解封</el-button>
        </div>

        <el-tabs>
          <el-tab-pane label="登录记录">
            <el-table :data="detail.logins" size="small">
              <el-table-column prop="login_type" label="方式" width="90" />
              <el-table-column prop="ip" label="IP" />
              <el-table-column prop="device_id" label="设备" show-overflow-tooltip />
              <el-table-column prop="result" label="结果" width="110" />
              <el-table-column label="时间" width="160">
                <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="设备">
            <el-table :data="detail.devices" size="small">
              <el-table-column prop="device_id" label="设备ID" show-overflow-tooltip />
              <el-table-column prop="device_type" label="类型" width="80" />
              <el-table-column prop="app_version" label="版本" width="80" />
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="近期战绩">
            <el-table :data="detail.results" size="small">
              <el-table-column prop="round_id" label="Round" width="170" />
              <el-table-column prop="game_id" label="游戏" width="130" />
              <el-table-column prop="score_change" label="输赢" width="90" />
              <el-table-column label="时间">
                <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="调账记录">
            <el-table :data="detail.adjustments" size="small">
              <el-table-column prop="admin_id" label="管理员" width="80" />
              <el-table-column prop="currency" label="币种" width="80" />
              <el-table-column prop="amount" label="金额" width="100" />
              <el-table-column prop="reason" label="原因" show-overflow-tooltip />
              <el-table-column prop="balance_after" label="调整后" width="100" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <!-- 调账（二次确认 + 原因必填） -->
    <el-dialog v-model="adjustOpen" title="调整用户资产（全程审计留痕）" width="440px">
      <el-form label-width="80px">
        <el-form-item label="币种">
          <el-select v-model="adjForm.currency">
            <el-option v-for="c in ['COIN', 'DIAMOND', 'POINT', 'TICKET']" :key="c" :value="c" :label="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额"><el-input-number v-model="adjForm.amount" :step="1000" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="adjForm.reason" type="textarea" placeholder="必填，将写入审计日志" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustOpen = false">取消</el-button>
        <el-button type="warning" @click="adjust">确认调整</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="banOpen" title="封禁用户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="时长(小时)"><el-input-number v-model="banForm.hours" :min="0" placeholder="0=永久" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="banForm.reason" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="banOpen = false">取消</el-button>
        <el-button type="danger" @click="ban">确认封禁</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api, can } from '../api.js';

const search = ref('');
const page = ref(1);
const items = ref<any[]>([]);
const loading = ref(false);
const showDetail = ref(false);
const detail = ref<any>(null);
const adjustOpen = ref(false);
const banOpen = ref(false);
const adjForm = ref({ currency: 'COIN', amount: 10000, reason: '' });
const banForm = ref({ hours: 0, reason: '' });

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = (await api<{ items: any[] }>(`/api/admin/v1/users?search=${encodeURIComponent(search.value)}&page=${page.value}`)).items;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function openDetail(row: any): Promise<void> {
  detail.value = await api(`/api/admin/v1/users/${row.id}`);
  showDetail.value = true;
}

async function adjust(): Promise<void> {
  const uid = detail.value.user.id;
  await ElMessageBox.confirm(`确认为用户 ${uid} ${adjForm.value.amount > 0 ? '增加' : '扣除'} ${Math.abs(adjForm.value.amount)} ${adjForm.value.currency}？`, '二次确认', { type: 'warning' });
  await api(`/api/admin/v1/users/${uid}/adjust`, { ...adjForm.value, confirm: true });
  ElMessage.success('已调整并留痕');
  adjustOpen.value = false;
  await openDetail({ id: uid });
}

async function ban(): Promise<void> {
  const uid = detail.value.user.id;
  await api(`/api/admin/v1/users/${uid}/ban`, { ...banForm.value, confirm: true });
  ElMessage.success('已封禁');
  banOpen.value = false;
  await openDetail({ id: uid });
  await load();
}

async function unban(): Promise<void> {
  const uid = detail.value.user.id;
  await api(`/api/admin/v1/users/${uid}/unban`, {});
  ElMessage.success('已解封');
  await openDetail({ id: uid });
  await load();
}

async function kick(): Promise<void> {
  await api(`/api/admin/v1/users/${detail.value.user.id}/kick`, {});
  ElMessage.success('已强制下线');
}
</script>

<style scoped>
.bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.acts {
  display: flex;
  gap: 8px;
  margin: 14px 0;
}
.detail :deep(.el-tabs) {
  margin-top: 6px;
}
</style>
