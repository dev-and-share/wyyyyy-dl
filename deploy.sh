#!/usr/bin/env bash
# deploy.sh — 一键 patch 版本升级 + commit + git tag + push + docker build
# 用法：./deploy.sh [patch|minor|major]  (默认 patch)
set -euo pipefail

BUMP=${1:-patch}
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
echo "🚀 升级到：$NEW_VERSION"

# ── 3. 写入 package.json ─────────────────────────────────────────────────────
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
"
echo "✅ package.json 已更新"

# ── 4. git commit + tag + push ───────────────────────────────────────────────
git add "$PKG"
git commit -m "chore: bump version to v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push
git push origin "v$NEW_VERSION"
echo "✅ git tag v$NEW_VERSION 已推送"

# ── 5. docker build + 启动 ───────────────────────────────────────────────────
docker compose up -d --build
echo "✅ 部署完成：v$NEW_VERSION 已上线"
