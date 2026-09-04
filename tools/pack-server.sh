#!/usr/bin/env bash
# 打包服务器源码为 tar.gz（不含 node_modules / dist / .env / 构建产物；按 git 追踪文件），供没有仓库权限的主机部署：
#   bash tools/pack-server.sh                → build/yanbian-server-<日期>-<commit>.tar.gz
# 主机上：tar xzf yanbian-server-*.tar.gz && cd yanbian && bash deploy/install-test-server.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
OUT="build/yanbian-server-$(date +%Y%m%d)-$(git rev-parse --short HEAD).tar.gz"
git archive --format=tar.gz --prefix=yanbian/ -o "$OUT" HEAD
echo "$OUT ($(du -h "$OUT" | cut -f1))"
