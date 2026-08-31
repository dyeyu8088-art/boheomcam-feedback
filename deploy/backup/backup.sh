#!/bin/sh
# 全量备份 + 财务表逻辑导出（WORM 建议：同步到对象存储开版本锁）
set -eu
TS=$(date +%Y%m%d_%H%M%S)
DIR=/backups
HOST=${PG_HOST:-postgres}
USER=${PG_USER:-yanbian}
DB=${PG_DB:-yanbian}

pg_dump -h "$HOST" -U "$USER" -Fc "$DB" > "$DIR/full_${TS}.dump"
psql -h "$HOST" -U "$USER" "$DB" -c "\copy wallet_ledger_entries TO '$DIR/ledger_${TS}.csv' CSV HEADER"
psql -h "$HOST" -U "$USER" "$DB" -c "\copy audit_logs TO '$DIR/audit_${TS}.csv' CSV HEADER"

# 保留 30 天
find "$DIR" -name 'full_*.dump' -mtime +30 -delete
find "$DIR" -name '*.csv' -mtime +30 -delete
echo "[backup] done $TS"
