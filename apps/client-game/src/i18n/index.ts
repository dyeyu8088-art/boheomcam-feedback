/** 轻量 i18n：中文/한국어 可切换（跟随系统，设置页可改），全部 UI 文案禁止散写。 */
import { computed, reactive } from 'vue';
import { zh } from './zh.js';
import { ko } from './ko.js';

export type Locale = 'zh' | 'ko';
const dicts: Record<Locale, Record<string, string>> = { zh, ko };

const state = reactive({
  locale: (localStorage.getItem('locale') as Locale | null) ?? (navigator.language.startsWith('ko') ? 'ko' : 'zh'),
});

export function setLocale(l: Locale): void {
  state.locale = l;
  localStorage.setItem('locale', l);
  document.documentElement.lang = l === 'ko' ? 'ko' : 'zh-CN';
}

export const currentLocale = computed(() => state.locale);

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dicts[state.locale][key] ?? dicts.zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}
