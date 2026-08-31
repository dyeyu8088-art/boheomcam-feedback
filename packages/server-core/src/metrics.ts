/** 轻量 Prometheus 指标（避免额外依赖；/metrics 文本格式输出） */
const counters = new Map<string, number>();
const gauges = new Map<string, number>();

export function counterInc(name: string, labels = '', by = 1): void {
  const key = labels ? `${name}{${labels}}` : name;
  counters.set(key, (counters.get(key) ?? 0) + by);
}

export function gaugeSet(name: string, value: number, labels = ''): void {
  const key = labels ? `${name}{${labels}}` : name;
  gauges.set(key, value);
}

export function renderMetrics(): string {
  const lines: string[] = [];
  for (const [k, v] of counters) lines.push(`${k} ${v}`);
  for (const [k, v] of gauges) lines.push(`${k} ${v}`);
  return lines.join('\n') + '\n';
}
