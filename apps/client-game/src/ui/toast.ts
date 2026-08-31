/** 全局 Toast（info/success/error），队列式顶部滑入 */
import { reactive } from 'vue';

export interface ToastItem {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

let seq = 0;
export const toasts = reactive<ToastItem[]>([]);

export function toast(text: string, kind: ToastItem['kind'] = 'info'): void {
  seq += 1;
  const item = { id: seq, kind, text };
  toasts.push(item);
  if (toasts.length > 3) toasts.shift();
  setTimeout(() => {
    const idx = toasts.findIndex((t) => t.id === item.id);
    if (idx >= 0) toasts.splice(idx, 1);
  }, 2400);
}
