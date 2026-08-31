<template>
  <div class="wrap">
    <el-card class="card">
      <template #header>
        <div class="head">
          <div class="brand">延边娱乐 · 运营管理后台</div>
          <div class="sub">YANBIAN GAME ADMIN</div>
        </div>
      </template>
      <el-form @submit.prevent="doLogin">
        <el-form-item>
          <el-input v-model="username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" placeholder="密码" size="large" show-password @keyup.enter="doLogin" />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="busy" @click="doLogin">登 录</el-button>
      </el-form>
    </el-card>

    <el-dialog v-model="showChange" title="首次登录必须修改密码" width="420px" :close-on-click-modal="false" :show-close="false">
      <el-form label-width="90px">
        <el-form-item label="原密码"><el-input v-model="oldPwd" type="password" /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="newPwd" type="password" placeholder="≥10位，含字母与数字" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="busy" @click="changePwd">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api, setSession, type AdminSession } from '../api.js';

const router = useRouter();
const username = ref('');
const password = ref('');
const oldPwd = ref('');
const newPwd = ref('');
const busy = ref(false);
const showChange = ref(false);

async function doLogin(): Promise<void> {
  busy.value = true;
  try {
    const data = await api<AdminSession & { token: string }>('/api/admin/v1/login', {
      username: username.value.trim(),
      password: password.value,
    });
    setSession(data);
    if (data.mustChangePassword) {
      oldPwd.value = password.value;
      showChange.value = true;
      return;
    }
    void router.replace('/dashboard');
  } catch {
    /* message 已弹 */
  } finally {
    busy.value = false;
  }
}

async function changePwd(): Promise<void> {
  busy.value = true;
  try {
    await api('/api/admin/v1/password', { oldPassword: oldPwd.value, newPassword: newPwd.value });
    ElMessage.success('密码已修改');
    showChange.value = false;
    void router.replace('/dashboard');
  } catch {
    /* noop */
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.wrap {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #10151f 0%, #1d2432 100%);
}
.card {
  width: 380px;
}
.head {
  text-align: center;
}
.brand {
  font-size: 18px;
  font-weight: 700;
}
.sub {
  font-size: 11px;
  color: #909399;
  letter-spacing: 0.3em;
  margin-top: 4px;
}
</style>
