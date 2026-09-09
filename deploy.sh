#!/usr/bin/env bash
# deploy.sh — 一键 patch 版本升级 + commit + git tag + push + docker build
# 用法：
#   ./deploy.sh                      (默认：本地运行，仅更新本地缓存名 + docker build，绝不提交和推送)
#   ./deploy.sh native               (本地 Native 模式：构建并启动原生镜像，端口 8081)
#   ./deploy.sh release [patch|minor|major] (生产发布：自动 commit + git tag + push + 触发 CI 构建)
set -euo pipefail

ACTION=${1:-local}
IS_RELEASE=false
BUMP="patch"

case "$ACTION" in
  native)
    echo "⚡ 本地 Native 模式：使用 docker-compose.native.yml 启动原生容器..."
    docker compose -f docker-compose.native.yml up -d --build
    echo "🎉 Native 容器已启动！访问地址：http://localhost:8081"
    exit 0
    ;;
  release|push|prod)
    IS_RELEASE=true
    BUMP=${2:-patch}
    ;;
  major|minor|patch)
    # 兼容传入版本幅度，但默认依然是安全的本地模式
    IS_RELEASE=false
    BUMP="$ACTION"
    ;;
  *)
    IS_RELEASE=false
    BUMP="patch"
    ;;
esac

PKG="frontend/package.json"

# ── 1. 读取当前版本 ──────────────────────────────────────────────────────────
CURRENT=$(node -p "require('./$PKG').version")
echo "📦 当前版本：$CURRENT"

# ── 2. 计算新版本 ────────────────────────────────────────────────────────────
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  *)     PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "🚀 目标版本：$NEW_VERSION"

# ── 3. 写入 package.json ─────────────────────────────────────────────────────
# 用 node 原地修改，避免 sed 的跨平台差异
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
"
sed -i '' "s/version = '[^']*'/version = '$NEW_VERSION'/" "build.gradle"
echo "✅ package.json 与 build.gradle 已更新"

# ── 4. 同步更新 sw.js 的 CACHE_NAME（触发浏览器检测到 SW 变更，清除旧缓存）────
SW_FILE="src/main/resources/static/sw.js"
sed -i '' "s/const CACHE_NAME = 'wyyyyy-dl-v[^']*'/const CACHE_NAME = 'wyyyyy-dl-v$NEW_VERSION'/" "$SW_FILE"
echo "✅ sw.js CACHE_NAME 已更新为 wyyyyy-dl-v$NEW_VERSION"

# ── 5. git commit + tag + push ───────────────────────────────────────────────
if [ "$IS_RELEASE" = false ]; then
  echo "⏩ 本地模式 (默认)：跳过 git commit、tag 与 push 流程，纯本地运行"
else
  git add "$PKG" "$SW_FILE" "build.gradle"
  git commit -m "chore: bump version to v$NEW_VERSION"
  git tag "v$NEW_VERSION"
  git push
  git push origin "v$NEW_VERSION"
  echo "✅ git tag v$NEW_VERSION 已推送"
fi

# ── 6. docker build + 启动 ───────────────────────────────────────────────────
docker compose up -d --build
if [ "$IS_RELEASE" = false ]; then
  echo "🎉 本地部署成功：v$NEW_VERSION 已在本地 Docker 运行 (未推送代码，无 git tag)"
else
  echo "✅ 部署完成：v$NEW_VERSION 已上线并推送"
fi
