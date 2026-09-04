# 单容器一体化镜像（仓库根目录 Dockerfile，Railway / Render / Fly.io 等平台自动识别）：PostgreSQL 16 + Redis 7 + api-service + game-service + Node 静态/反代边缘（deploy/allinone/edge.mjs）
# 适用于只给「一个容器 + 一个端口」的托管平台（Railway / Render / Fly.io / Manufact 等）与快速内测；
# 数据在 /data（挂卷即持久化；不挂卷则重建容器后清空）。对外正式发布仍用 docker-compose.prod.yml（HTTPS / 备份 / 监控）。
#
#   docker build -t yanbian-allinone .          # 仓库根目录的 Dockerfile 即本文件（托管平台自动识别）
#   docker run -d -p 80:80 -v yanbian-data:/data yanbian-allinone       # 日志里打印后台初始密码
#
# 运行时基础镜像取 postgres:16-alpine（含 PG、libstdc++、openssl），Node / Redis 二进制从官方同版本 Alpine 镜像拷入，
# 因此构建不依赖 apk 仓库；三者均为 Alpine 3.24 / musl，ABI 一致。
ARG IMAGE_PREFIX=
FROM ${IMAGE_PREFIX}node:22-alpine AS build
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV npm_config_registry=${NPM_REGISTRY} COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
COPY database ./database
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile=false
# 管理后台挂在 /admin/ 下；两个前端产物移到 /srv/www 后删除 apps（运行时只需 services / packages / database）
RUN pnpm --filter @yanbian/client-game build \
 && VITE_BASE=/admin/ pnpm --filter @yanbian/admin-web build \
 && mkdir -p /srv/www && mv apps/client-game/dist /srv/www/client && mv apps/admin-web/dist /srv/www/admin \
 && rm -rf apps

FROM ${IMAGE_PREFIX}redis:7-alpine AS redis
FROM ${IMAGE_PREFIX}node:22-alpine AS node

FROM ${IMAGE_PREFIX}postgres:16-alpine
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=redis /usr/local/bin/redis-server /usr/local/bin/redis-server
COPY --from=build /app /app
COPY --from=build /srv/www /srv/www
COPY deploy/allinone/edge.mjs /app/deploy/allinone/edge.mjs
COPY deploy/allinone/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && node --version && redis-server --version >/dev/null && postgres --version
# 数据目录 /data：在平台侧挂卷（Railway Volumes / Render Disk / docker -v）。不写 VOLUME 指令：Railway 构建器拒绝含 VOLUME 的 Dockerfile
ENV NODE_ENV=production PORT=80
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD []
