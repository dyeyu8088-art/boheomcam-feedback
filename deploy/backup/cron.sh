#!/bin/sh
# 每日 02:00 全量 pg_dump（保留 30 天）+ 账本审计导出
set -eu
while true; do
  NOW_H=$(date +%H%M)
  if [ "$NOW_H" = "0200" ]; then
    /backup/backup.sh || echo "[backup] FAILED at $(date -Iseconds)"
    sleep 70
  fi
  sleep 30
done
