#!/usr/bin/env bash
# 内测服务器一键安装（Ubuntu / Debian / CentOS 等，root 或 sudo；一台 2 vCPU / 2 GB 主机，开放 TCP 80）：
#   git clone <仓库地址> yanbian && cd yanbian && bash deploy/install-test-server.sh
# 步骤：装 Docker（缺失时）→ 生成 .env（随机密码 / 密钥，不入 Git）→ 构建镜像 → 建库迁移 → 启动 → 打印 APK 要填的地址与后台初始密码。
# 重复执行是安全的（.env 保留、迁移幂等、镜像增量构建）。
# 注意：HTTP 明文，仅供内部测试；对外正式发布按 docs/10-deployment.md §2（HTTPS/WSS + 备份 + 监控）。
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf '\n[install] %s\n' "$*"; }

if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker …"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker >/dev/null 2>&1 || true
fi
docker compose version >/dev/null 2>&1 || { echo "需要 docker compose v2（Debian/Ubuntu: apt install docker-compose-plugin）" >&2; exit 1; }

if [ ! -f .env ]; then
  rand() { openssl rand -hex "$1"; }
  cat > .env <<ENVEOF
# 由 deploy/install-test-server.sh 生成（内测）。禁止提交到 Git。
NODE_ENV=production
PG_USER=yanbian
PG_PASSWORD=$(rand 16)
REDIS_PASSWORD=$(rand 16)
JWT_SECRET=$(rand 32)
INTERNAL_TOKEN=$(rand 32)
ADMIN_INIT_PASSWORD=$(rand 8)
HTTP_PORT=80
LOG_LEVEL=info
# 国内主机构建慢可启用 npm 镜像源：
# NPM_REGISTRY=https://registry.npmmirror.com
ENVEOF
  chmod 600 .env
  log "已生成 .env（随机密码 / 密钥）"
fi
set -a; . ./.env; set +a
HTTP_PORT="${HTTP_PORT:-80}"

COMPOSE=(docker compose -f deploy/docker-compose.test.yml --env-file .env)

log "构建镜像（首次约 5–10 分钟）…"
"${COMPOSE[@]}" build

log "启动数据库 / Redis …"
"${COMPOSE[@]}" up -d postgres redis

log "建库 / 迁移 / 种子 / 初始管理员 …"
"${COMPOSE[@]}" run --rm api npx tsx src/migrate.ts

log "启动全部服务 …"
"${COMPOSE[@]}" up -d

for _ in $(seq 1 60); do
  curl -fsS -o /dev/null "http://127.0.0.1:${HTTP_PORT}/" 2>/dev/null && break
  sleep 1
done

IP="$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
ADDR="http://${IP}"
[ "$HTTP_PORT" != "80" ] && ADDR="${ADDR}:${HTTP_PORT}"

cat <<MSGEOF

==============================================
 内测服务器已启动
 APK / H5 登录页「服务器设置」填:  ${ADDR}
 手机浏览器直接玩（H5）:          ${ADDR}/
 管理后台:                        ${ADDR}/admin/   账号 admin   初始密码: ${ADMIN_INIT_PASSWORD}（首登强制改密）
 云主机请在安全组 / 防火墙放行 TCP ${HTTP_PORT}
 日志:  docker compose -f deploy/docker-compose.test.yml --env-file .env logs -f api game
 停止:  docker compose -f deploy/docker-compose.test.yml --env-file .env down
 更新:  git pull && bash deploy/install-test-server.sh
==============================================
MSGEOF
