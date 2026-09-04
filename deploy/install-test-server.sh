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
# Docker Hub 不可达且已配 registry-mirrors 仍失败时可指定基础镜像前缀：
# IMAGE_PREFIX=mirror.gcr.io/library/
ENVEOF
  chmod 600 .env
  log "已生成 .env（随机密码 / 密钥）"
fi
set -a; . ./.env; set +a
HTTP_PORT="${HTTP_PORT:-80}"

# 基础镜像来源探测：Docker Hub（默认，国内可配 registry-mirrors）→ mirror.gcr.io → 提示配置镜像加速
if [ -z "${IMAGE_PREFIX:-}" ] && ! docker pull -q alpine:3.20 >/dev/null 2>&1; then
  if docker pull -q mirror.gcr.io/library/alpine:3.20 >/dev/null 2>&1; then
    export IMAGE_PREFIX=mirror.gcr.io/library/
    grep -q '^IMAGE_PREFIX=' .env || echo "IMAGE_PREFIX=${IMAGE_PREFIX}" >> .env
    log "Docker Hub 不可达，基础镜像改从 mirror.gcr.io 拉取"
  else
    cat >&2 <<MSG
[install] 无法拉取 Docker 镜像（Docker Hub 与 mirror.gcr.io 均不可达）。
  国内主机请先配置镜像加速：编辑 /etc/docker/daemon.json，例如
    { "registry-mirrors": ["https://<你的加速器地址>"] }
  （阿里云 / 腾讯云控制台的「容器镜像服务 → 镜像加速器」可获取地址），然后
    systemctl restart docker && bash deploy/install-test-server.sh
MSG
    exit 1
  fi
fi

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

# 局域网 IP（Linux: hostname -I；macOS: ipconfig getifaddr；Windows Git Bash / WSL: ipconfig.exe）
lan_ip() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -z "$ip" ] && ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(ipconfig.exe 2>/dev/null | tr -d '\r' | grep -i 'IPv4' | grep -v '172\.\(1[6-9]\|2[0-9]\|3[01]\)\.' | head -1 | sed 's/.*: *//')"
  echo "$ip"
}
LAN_IP="$(lan_ip)"
PUB_IP="$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || true)"
PORT_SUFFIX=""
[ "$HTTP_PORT" != "80" ] && PORT_SUFFIX=":${HTTP_PORT}"

cat <<MSGEOF

==============================================
 内测服务器已启动（APK / H5 登录页「服务器设置」填下面任一可达地址）
 局域网（同一 Wi-Fi 的手机 / 本机）:  http://${LAN_IP:-<本机IP>}${PORT_SUFFIX}
 公网（云主机直接可用；家用电脑需路由器把 TCP ${HTTP_PORT} 映射到本机，或用 cloudflared）:  http://${PUB_IP:-<公网IP>}${PORT_SUFFIX}
 管理后台:  <地址>/admin/   账号 admin   初始密码: ${ADMIN_INIT_PASSWORD}（首登强制改密）
 云主机请在安全组 / 防火墙放行 TCP ${HTTP_PORT}；Windows 首次运行若弹防火墙提示请选择「允许」
 日志:  docker compose -f deploy/docker-compose.test.yml --env-file .env logs -f api game
 停止:  docker compose -f deploy/docker-compose.test.yml --env-file .env down
 更新:  重新上传 / git pull 新代码后再执行 bash deploy/install-test-server.sh（数据保留）
==============================================
MSGEOF
