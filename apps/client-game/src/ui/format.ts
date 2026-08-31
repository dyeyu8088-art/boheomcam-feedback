/** 展示格式化工具 */
const AVATARS = ['🀄', '🦁', '🐯', '🦅', '🐉', '🦊', '🐺', '🦌', '🐢', '🦈', '🐙', '🦚', '🐴', '🦉', '🐻', '🦋', '🐬', '🌸', '🍀', '⭐', '🌙', '🔥', '🎐', '🏮'];

export function avatarEmoji(id: number): string {
  return AVATARS[(id - 1) % AVATARS.length] ?? '🀄';
}

export function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString();
}

export function fmtSigned(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (x: number): string => String(x).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
