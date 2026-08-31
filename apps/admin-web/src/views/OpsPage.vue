<template>
  <el-row :gutter="14">
    <el-col :span="12">
      <el-card shadow="never" header="发布公告（中/韩双语）">
        <el-form label-width="90px">
          <el-form-item label="标题(中)"><el-input v-model="ann.title" /></el-form-item>
          <el-form-item label="标题(한)"><el-input v-model="ann.titleKo" /></el-form-item>
          <el-form-item label="内容(中)"><el-input v-model="ann.body" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="内容(한)"><el-input v-model="ann.bodyKo" type="textarea" :rows="3" /></el-form-item>
          <el-button type="primary" @click="publishAnn">发布</el-button>
        </el-form>
      </el-card>
    </el-col>
    <el-col :span="12">
      <el-card shadow="never" header="发送系统邮件（附件走钱包留痕）">
        <el-form label-width="90px">
          <el-form-item label="收件UID"><el-input-number v-model="mail.toUid" :controls="false" style="width: 200px" /></el-form-item>
          <el-form-item label="标题"><el-input v-model="mail.title" /></el-form-item>
          <el-form-item label="内容"><el-input v-model="mail.body" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="附件金币"><el-input-number v-model="mailCoins" :min="0" :step="1000" /></el-form-item>
          <el-button type="primary" @click="sendMail">发送</el-button>
        </el-form>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api.js';

const ann = ref({ title: '', titleKo: '', body: '', bodyKo: '' });
const mail = ref({ toUid: 0, title: '', body: '' });
const mailCoins = ref(0);

async function publishAnn(): Promise<void> {
  await api('/api/admin/v1/announcements', ann.value);
  ElMessage.success('公告已发布');
  ann.value = { title: '', titleKo: '', body: '', bodyKo: '' };
}

async function sendMail(): Promise<void> {
  const attachments = mailCoins.value > 0 ? [{ currency: 'COIN', amount: mailCoins.value }] : [];
  if (attachments.length) {
    await ElMessageBox.confirm(`确认向 UID ${mail.value.toUid} 发送含 ${mailCoins.value} 金币附件的邮件？`, '二次确认', { type: 'warning' });
  }
  await api('/api/admin/v1/mail/send', { ...mail.value, attachments, confirm: true });
  ElMessage.success('邮件已发送');
  mail.value = { toUid: 0, title: '', body: '' };
  mailCoins.value = 0;
}
</script>
