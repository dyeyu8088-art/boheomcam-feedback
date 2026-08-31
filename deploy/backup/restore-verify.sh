#!/bin/sh
# 每周恢复演练：还原最新备份到临时库并校验账本平衡（备份不可恢复=没有备份）
set -eu
HOST=${PG_HOST:-postgres}
USER=${PG_USER:-yanbian}
LATEST=$(ls -t /backups/full_*.dump | head -1)
echo "verify restore of $LATEST"
psql -h "$HOST" -U "$USER" postgres -c "DROP DATABASE IF EXISTS yanbian_verify"
psql -h "$HOST" -U "$USER" postgres -c "CREATE DATABASE yanbian_verify"
pg_restore -h "$HOST" -U "$USER" -d yanbian_verify "$LATEST"
SUM=$(psql -h "$HOST" -U "$USER" yanbian_verify -tAc "SELECT COALESCE(SUM(amount),0) FROM wallet_ledger_entries")
ROWS=$(psql -h "$HOST" -U "$USER" yanbian_verify -tAc "SELECT COUNT(*) FROM wallet_transactions")
psql -h "$HOST" -U "$USER" postgres -c "DROP DATABASE yanbian_verify"
if [ "$SUM" != "0" ]; then
  echo "[restore-verify] LEDGER IMBALANCE: $SUM"
  exit 1
fi
echo "[restore-verify] OK: ledger balanced, $ROWS transactions"
