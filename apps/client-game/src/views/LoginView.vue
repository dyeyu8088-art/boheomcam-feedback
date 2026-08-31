<template>
  <div class="login">
    <div class="bg">
      <div class="orb orb-a" />
      <div class="orb orb-b" />
      <div v-for="n in 18" :key="n" class="mote" :style="moteStyle(n)" />
    </div>

    <div class="panel">
      <div class="brand">
        <svg class="emblem" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="emGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#f0dcab" />
              <stop offset="0.5" stop-color="#c9a063" />
              <stop offset="1" stop-color="#8a6b3c" />
            </linearGradient>
            <radialGradient id="emGlow" cx="0.5" cy="0.42" r="0.6">
              <stop offset="0" stop-color="#c9a063" stop-opacity="0.28" />
              <stop offset="1" stop-color="#c9a063" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="58" fill="url(#emGlow)" />
          <circle cx="60" cy="60" r="46" fill="none" stroke="url(#emGold)" stroke-width="2.4" />
          <circle cx="60" cy="60" r="40.5" fill="none" stroke="url(#emGold)" stroke-width="0.8" opacity="0.6" />
          <!-- 旭日 -->
          <circle cx="60" cy="46" r="9" fill="none" stroke="url(#emGold)" stroke-width="1.8" />
          <path d="M60 30 v-5 M74 36 l3.4 -3.4 M46 36 l-3.4 -3.4" stroke="url(#emGold)" stroke-width="1.6" stroke-linecap="round" />
          <!-- 长白双峰与天池 -->
          <path d="M22 78 L42 54 L52 66 L64 48 L82 70 L90 62 L98 78" fill="none" stroke="url(#emGold)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M50 78 q10 -7 20 0" fill="none" stroke="url(#emGold)" stroke-width="1.6" stroke-linecap="round" opacity="0.85" />
          <path d="M30 88 h60" stroke="url(#emGold)" stroke-width="1.2" stroke-linecap="round" opacity="0.55" />
          <path d="M38 94 h44" stroke="url(#emGold)" stroke-width="1" stroke-linecap="round" opacity="0.35" />
        </svg>
        <div class="mark">{{ locale === 'ko' ? user.brand.nameKo : user.brand.nameZh }}</div>
        <div class="sub">{{ user.brand.nameEn }}</div>
        <div class="slogan">{{ t('login.slogan') }}</div>
      </div>

      <div class="card glass">
        <template v-if="mode === 'entry'">
          <button class="btn btn-primary big" :disabled="busy" @click="guest">
            <span v-if="busy" class="spinner" />{{ t('login.guest') }}
          </button>
          <button class="btn btn-secondary big" @click="mode = 'sms'">{{ t('login.phone') }}</button>
        </template>

        <template v-else>
          <input v-model="phone" class="input" :placeholder="t('login.phone.placeholder')" maxlength="11" inputmode="numeric" />
          <div v-if="mode === 'sms'" class="row">
            <input v-model="code" class="input" :placeholder="t('login.code.placeholder')" maxlength="6" inputmode="numeric" />
            <button class="btn btn-secondary btn-sm" :disabled="countdown > 0 || phone.length !== 11" @click="sendCode">
              {{ countdown > 0 ? t('login.code.sent', { n: countdown }) : t('login.code.send') }}
            </button>
          </div>
          <input v-else v-model="password" class="input" type="password" :placeholder="t('login.password.placeholder')" maxlength="64" />
          <button class="btn btn-primary big" :disabled="busy" @click="submit">
            <span v-if="busy" class="spinner" />{{ t('login.submit') }}
          </button>
          <div class="switch">
            <a @click="mode = mode === 'sms' ? 'password' : 'sms'">{{ mode === 'sms' ? t('login.mode.password') : t('login.mode.code') }}</a>
            <a @click="mode = 'entry'">{{ t('common.back') }}</a>
          </div>
        </template>
      </div>

      <div class="lang">
        <a :class="{ on: locale === 'zh' }" @click="setLocale('zh')">中文</a>
        <span>·</span>
        <a :class="{ on: locale === 'ko' }" @click="setLocale('ko')">한국어</a>
      </div>
      <p class="agreement">{{ t('login.agreement') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import { api } from '../net/api.js';
import { t, setLocale, currentLocale } from '../i18n/index.js';
import { toast } from '../ui/toast.js';

const router = useRouter();
const user = useUserStore();
const locale = currentLocale;
const mode = ref<'entry' | 'sms' | 'password'>('entry');
const phone = ref('');
const code = ref('');
const password = ref('');
const busy = ref(false);
const countdown = ref(0);

onMounted(() => void user.loadBrand());

function moteStyle(n: number): Record<string, string> {
  const left = (n * 53) % 100;
  const delay = (n * 0.7) % 6;
  const dur = 6 + ((n * 1.3) % 6);
  const size = 2 + (n % 3);
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${dur}s`,
    width: `${size}px`,
    height: `${size}px`,
  };
}

async function guest(): Promise<void> {
  busy.value = true;
  try {
    await user.guestLogin();
    void router.replace('/lobby');
  } catch (e) {
    toast((e as Error).message || t('error.generic'), 'error');
  } finally {
    busy.value = false;
  }
}

async function sendCode(): Promise<void> {
  try {
    const r = await api<{ devCode?: string }>('/api/v1/auth/sms/send', { phone: phone.value, purpose: 'login' });
    countdown.value = 60;
    const timer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
    if (r.devCode) {
      code.value = r.devCode;
      toast(`DEV 验证码: ${r.devCode}`);
    }
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

async function submit(): Promise<void> {
  busy.value = true;
  try {
    if (mode.value === 'sms') await user.smsLogin(phone.value, code.value);
    else await user.passwordLogin(phone.value, password.value);
    void router.replace('/lobby');
  } catch (e) {
    toast((e as Error).message || t('error.generic'), 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.login {
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(120% 90% at 50% 0%, #141b29 0%, var(--bg-abyss) 62%);
}
.bg {
  position: absolute;
  inset: 0;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}
.orb-a {
  width: 420px;
  height: 420px;
  background: #1c2c45;
  top: -120px;
  left: -100px;
  animation: float-slow 9s ease-in-out infinite;
}
.orb-b {
  width: 360px;
  height: 360px;
  background: rgba(201, 160, 99, 0.16);
  bottom: -100px;
  right: -80px;
  animation: float-slow 11s ease-in-out infinite reverse;
}
.mote {
  position: absolute;
  bottom: -8px;
  border-radius: 50%;
  background: rgba(230, 207, 163, 0.5);
  animation: rise linear infinite;
}
@keyframes rise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  12% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-105vh);
    opacity: 0;
  }
}
.panel {
  position: relative;
  width: min(380px, 88vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding-bottom: var(--safe-bottom);
}
.brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.emblem {
  width: 108px;
  height: 108px;
  margin-bottom: 6px;
  filter: drop-shadow(0 4px 18px rgba(201, 160, 99, 0.25));
  animation: float-slow 7s ease-in-out infinite;
}
.mark {
  font-size: 44px;
  font-weight: 800;
  letter-spacing: 0.18em;
  background: linear-gradient(180deg, #f4e5c3 0%, var(--gold-warm) 55%, var(--gold-deep) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 6px 30px rgba(201, 160, 99, 0.25);
}
.sub {
  margin-top: 4px;
  font-size: 12px;
  letter-spacing: 0.55em;
  color: var(--text-secondary);
  padding-left: 0.55em;
}
.slogan {
  margin-top: 14px;
  font-size: 13px;
  color: var(--gold-champagne);
  letter-spacing: 0.3em;
  opacity: 0.85;
  padding-left: 0.3em;
}
.card {
  width: 100%;
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.big {
  width: 100%;
  padding: 14px;
  font-size: 16px;
}
.row {
  display: flex;
  gap: 10px;
}
.row .input {
  flex: 1;
}
.row .btn {
  white-space: nowrap;
}
.switch {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.switch a {
  color: var(--gold-warm);
  cursor: pointer;
}
.lang {
  display: flex;
  gap: 10px;
  color: var(--text-disabled);
  font-size: 13px;
}
.lang a {
  cursor: pointer;
  color: var(--text-secondary);
}
.lang a.on {
  color: var(--gold-champagne);
}
.agreement {
  font-size: 11px;
  color: var(--text-disabled);
  text-align: center;
  line-height: 1.6;
  margin: 0;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(230, 207, 163, 0.3);
  border-top-color: var(--gold-champagne);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
