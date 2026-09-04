#!/bin/sh
# 一体化容器入口：PostgreSQL → Redis → 迁移 → api + game → 边缘（静态 + /api 反代 + /ws 升级）。
# 环境变量：PORT（默认 80）、ADMIN_INIT_PASSWORD / JWT_SECRET / INTERNAL_TOKEN（缺省自动生成并持久化到 /data/secrets.env）、
#           SERVER_ID、LOG_LEVEL、IP_RATE_LIMIT、AUTH_RATE_LIMIT。数据目录 /data（挂卷即持久化）。
set -eu
PORT="${PORT:-80}"
DATA=/data
PGDATA="$DATA/pg"
mkdir -p "$PGDATA" "$DATA/redis"
touch "$DATA/pg.log"
chown -R postgres:postgres "$PGDATA" "$DATA/pg.log"
chmod 700 "$PGDATA"

rand_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
# 密钥持久化：容器重建后 JWT 仍有效、后台初始密码不变
if [ -f "$DATA/secrets.env" ]; then . "$DATA/secrets.env"; fi
JWT_SECRET="${JWT_SECRET:-$(rand_hex 32)}"
INTERNAL_TOKEN="${INTERNAL_TOKEN:-$(rand_hex 32)}"
ADMIN_INIT_PASSWORD="${ADMIN_INIT_PASSWORD:-$(rand_hex 6)}"
printf 'JWT_SECRET=%s\nINTERNAL_TOKEN=%s\nADMIN_INIT_PASSWORD=%s\n' "$JWT_SECRET" "$INTERNAL_TOKEN" "$ADMIN_INIT_PASSWORD" > "$DATA/secrets.env"
chmod 600 "$DATA/secrets.env"
export JWT_SECRET INTERNAL_TOKEN ADMIN_INIT_PASSWORD
export NODE_ENV=production
export SERVER_ID="${SERVER_ID:-allinone}"
export NODE_INDEX="${NODE_INDEX:-2}"
export DATABASE_URL="postgres://yanbian@127.0.0.1:5432/yanbian"
export REDIS_URL="redis://127.0.0.1:6379"
export API_PORT=8080
export GAME_PORT=8090
export SERVICE_ROLES="${SERVICE_ROLES:-auth,user,wallet,activity,social,config,admin}"
export LOG_LEVEL="${LOG_LEVEL:-info}"

echo "[allinone] starting postgres"
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  su-exec postgres initdb -D "$PGDATA" -U yanbian --auth=trust -E UTF8 --locale=C >/dev/null
fi
su-exec postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses=127.0.0.1 -c port=5432 -c shared_buffers=64MB" -l "$DATA/pg.log" -w start >/dev/null
if ! su-exec postgres psql -U yanbian -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='yanbian'" | grep -q 1; then
  su-exec postgres createdb -U yanbian yanbian
fi

echo "[allinone] starting redis"
redis-server --daemonize yes --bind 127.0.0.1 --port 6379 --dir "$DATA/redis" --appendonly yes --save "" --logfile "$DATA/redis.log" >/dev/null

echo "[allinone] migrate"
(cd /app/services/api && /app/node_modules/.bin/tsx src/migrate.ts)

echo "[allinone] starting api / game / edge on port $PORT"
(cd /app/services/api && exec /app/node_modules/.bin/tsx src/main.ts) &
API_PID=$!
(cd /app/services/game && exec /app/node_modules/.bin/tsx src/main.ts) &
GAME_PID=$!
node /app/deploy/allinone/edge.mjs &
EDGE_PID=$!

shutdown() {
  echo "[allinone] shutting down"
  kill "$EDGE_PID" "$API_PID" "$GAME_PID" 2>/dev/null || true
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true
  kill "$(cat "$DATA/redis/redis.pid" 2>/dev/null || pgrep redis-server)" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

cat <<MSG
==============================================
 延边娱乐 一体化容器已启动（端口 $PORT）
 客户端 H5 / APK「服务器设置」:  http(s)://<本容器对外地址>
 管理后台:  <地址>/admin/   账号 admin   首次登录密码: $ADMIN_INIT_PASSWORD
 金币 / 钻石均为游戏内虚拟娱乐资产，不可兑换现金；本镜像为内测用途
==============================================
MSG

# 任一核心进程退出即整体退出，交给平台重启
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$GAME_PID" 2>/dev/null && kill -0 "$EDGE_PID" 2>/dev/null; do
  sleep 5
done
echo "[allinone] a core process exited"
shutdown
