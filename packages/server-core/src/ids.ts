/**
 * 雪花变体 ID：42bit 毫秒时间戳(自定义纪元) + 6bit 节点 + 5bit 序列。
 * 总计 53bit，保证落在 JS 安全整数范围内（前后端可直接用 number）。
 * 每毫秒每节点 32 个；超出自旋到下一毫秒 —— 单节点 3.2 万/秒，配合多节点足够。
 */
const EPOCH = 1735689600000; // 2025-01-01T00:00:00Z

let nodeId = 0;
let lastMs = -1;
let seq = 0;

export function initIdGenerator(node: number): void {
  nodeId = node & 0x3f;
}

export function nextId(): number {
  let now = Date.now();
  if (now === lastMs) {
    seq += 1;
    if (seq >= 32) {
      while (now <= lastMs) now = Date.now();
      seq = 0;
    }
  } else {
    seq = 0;
  }
  lastMs = now;
  return (now - EPOCH) * 2048 + nodeId * 32 + seq;
}

/** 用户 UID：独立段（8 位数字起步，非连续防枚举） */
export function nextUid(): number {
  // 10000000 + 时间低位混淆 + 随机扰动，由调用方在冲突时重试
  const base = 10000000;
  const rand = Math.floor(Math.random() * 89999999);
  return base + rand;
}

/** 6 位房间号 */
export function nextRoomNo(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}
