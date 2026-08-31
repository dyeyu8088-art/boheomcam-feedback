<template>
  <el-row :gutter="14">
    <el-col :span="14">
      <el-card shadow="never" header="后台账号">
        <el-table v-loading="loading" :data="admins" size="small">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="username" label="用户名" width="130" />
          <el-table-column prop="display_name" label="名称" width="130" />
          <el-table-column label="角色">
            <template #default="{ row }">
              <el-tag v-for="r in row.roles" :key="r" size="small" style="margin-right: 4px">{{ r }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90" />
          <el-table-column label="最后登录" width="170">
            <template #default="{ row }">{{ row.last_login_at ? new Date(row.last_login_at).toLocaleString() : '—' }}</template>
          </el-table-column>
        </el-table>
        <el-divider />
        <el-form :inline="true">
          <el-form-item><el-input v-model="form.username" placeholder="用户名" style="width: 130px" /></el-form-item>
          <el-form-item><el-input v-model="form.password" placeholder="初始密码≥10位" type="password" style="width: 160px" /></el-form-item>
          <el-form-item>
            <el-select v-model="form.roles" multiple placeholder="角色" style="width: 220px">
              <el-option v-for="r in roles" :key="r.code" :value="r.code" :label="r.name" />
            </el-select>
          </el-form-item>
          <el-button type="primary" @click="createAdmin">创建</el-button>
        </el-form>
      </el-card>
    </el-col>
    <el-col :span="10">
      <el-card shadow="never" header="角色与权限（RBAC）">
        <el-collapse>
          <el-collapse-item v-for="r in roles" :key="r.code" :title="`${r.name} (${r.code})`">
            <el-tag v-for="p in r.permissions" :key="p" size="small" type="info" style="margin: 2px">{{ p }}</el-tag>
          </el-collapse-item>
        </el-collapse>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api.js';

const admins = ref<any[]>([]);
const roles = ref<any[]>([]);
const loading = ref(false);
const form = ref({ username: '', password: '', roles: [] as string[] });

async function load(): Promise<void> {
  loading.value = true;
  try {
    admins.value = (await api<{ items: any[] }>('/api/admin/v1/admins')).items;
    roles.value = (await api<{ items: any[] }>('/api/admin/v1/roles')).items;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function createAdmin(): Promise<void> {
  await api('/api/admin/v1/admins', { ...form.value, displayName: form.value.username });
  ElMessage.success('已创建（首登强制改密）');
  form.value = { username: '', password: '', roles: [] };
  await load();
}
</script>
