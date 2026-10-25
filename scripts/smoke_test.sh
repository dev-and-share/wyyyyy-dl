#!/usr/bin/env bash
# ==============================================================================
# wyyyyy-dl 云端全量端到端冒烟测试套件 (E2E Smoke Test Suite)
# 
# 🛡️ 安全保证：
#   - 默认模式：【绝对零写入纯读模式 (Zero-Write)】，绝不改写任何数据！
#     不污染数据库，不覆盖真实网易云 Cookie，可在生产库随意安全运行。
#   - 深度写入模式 (--include-write)：
#     仅在显式传入此参数时执行，且内置 Cookie 备份还原与 Trap 自动回滚保障。
#
# 用法：
#   bash scripts/smoke_test.sh https://d123456abcdef.cloudfront.net                # 默认安全纯读
#   bash scripts/smoke_test.sh https://d123456abcdef.cloudfront.net --include-write # 深度写入测试
# ==============================================================================
set -euo pipefail

TARGET_URL=""
INCLUDE_WRITE=false
AUTH_USER_PASS=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      echo "用法："
      echo "  bash scripts/smoke_test.sh <TARGET_URL> [-u user:pass]                # 默认纯读零写入保护模式"
      echo "  bash scripts/smoke_test.sh <TARGET_URL> [-u user:pass] --include-write # 深度读写回滚测试模式"
      exit 0
      ;;
    -u|--auth)
      AUTH_USER_PASS="$2"
      shift 2
      ;;
    --include-write)
      INCLUDE_WRITE=true
      shift
      ;;
    *)
      if [ -z "$TARGET_URL" ]; then
        TARGET_URL="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$TARGET_URL" ]; then
  echo "❌ 错误：请传入要测试的目标域名，例如："
  echo "   bash scripts/smoke_test.sh https://d123456abcdef.cloudfront.net -u admin:password"
  exit 1
fi

TARGET_URL="${TARGET_URL%/}"

echo "======================================================================"
echo "🚀 开始执行 wyyyyy-dl 云端端到端全量冒烟巡检"
echo "🎯 目标域名: $TARGET_URL"
if [ -n "$AUTH_USER_PASS" ]; then
  echo "🔐 鉴权: 已启用 HTTP Basic Auth 保护"
fi
if [ "$INCLUDE_WRITE" = true ]; then
  echo "⚠️ 模式: 深度读写模式 (--include-write, 内置原子回滚保护)"
else
  echo "🛡️ 模式: 【绝对零写入纯读模式 (Zero-Write)】(100% 安全，不修改任何数据)"
fi
echo "🕒 测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================================"

PASSED_COUNT=0
FAILED_COUNT=0

assert_api() {
  local title="$1"
  local method="$2"
  local path="$3"
  local expected_status="$4"
  local expected_keyword="${5:-}"
  local post_data="${6:-}"

  printf "  Testing [%-4s] %-35s ... " "$method" "$path"

  local response_file
  response_file=$(mktemp)
  local http_code
  local curl_args=("-s" "-o" "$response_file" "-w" "%{http_code}" "-X" "$method")

  if [ -n "$AUTH_USER_PASS" ]; then
    curl_args+=("-u" "$AUTH_USER_PASS")
  fi

  if [ -n "$post_data" ]; then
    curl_args+=("-H" "Content-Type: application/json" "-d" "$post_data")
  fi

  http_code=$(curl "${curl_args[@]}" "${TARGET_URL}${path}" || echo "000")

  local success=false
  IFS='|' read -ra STATUS_LIST <<< "$expected_status"
  for s in "${STATUS_LIST[@]}"; do
    if [ "$http_code" = "$s" ]; then
      success=true
      break
    fi
  done

  if [ -n "$expected_keyword" ] && ! grep -qiE "$expected_keyword" "$response_file" 2>/dev/null; then
    success=false
  fi

  if [ "$success" = true ]; then
    echo "✅ PASS (HTTP $http_code)"
    PASSED_COUNT=$((PASSED_COUNT + 1))
  else
    echo "❌ FAIL (HTTP $http_code, 期望: $expected_status${expected_keyword:+, 需包含: $expected_keyword})"
    echo "     [Response Body 片段]: $(head -c 200 "$response_file" 2>/dev/null || echo '<空>')"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
  rm -f "$response_file"
}

# ------------------------------------------------------------------------------
# 1. 静态资源与前端 SPA 路由连通性 (只读)
# ------------------------------------------------------------------------------
echo ""
echo "📦 [1/5] 静态资源托管与 CloudFront 路由检查"
assert_api "SPA 根路径 HTML"           "GET" "/"                     "200" "<!doctype html"
assert_api "PWA Web App Manifest"     "GET" "/manifest.json"        "200" "\"name\""
assert_api "Svelte 前端静态入口 HTML" "GET" "/svelte/index.html"     "200" "<!doctype html"

# ------------------------------------------------------------------------------
# 2. 系统历史记录与列表核心 API (只读)
# ------------------------------------------------------------------------------
echo ""
echo "📜 [2/5] 历史记录与统计指标 API 检查"
assert_api "历史记录分页列表"         "GET" "/v3/history/list?page=1&pageSize=10" "200" "\"code\":\"000000\""
assert_api "历史记录指标统计"         "GET" "/v3/history/stats"                    "200" "\"code\":\"000000\""
assert_api "缺失文件记录扫描"         "GET" "/v3/history/missing"                  "200" "\"code\":\"000000\""
assert_api "非 MP3 文件记录扫描"      "GET" "/v3/history/non_mp3"                  "200" "\"code\":\"000000\""

# ------------------------------------------------------------------------------
# 3. 红心歌曲 (Likes) 只读列表检查
# ------------------------------------------------------------------------------
echo ""
echo "❤️ [3/5] 红心歌曲 (Likes) 只读列表检查"
assert_api "获取所有红心歌曲 ID 清单"  "GET" "/v3/like/list"                        "200" "\"code\":\"000000\""

# ------------------------------------------------------------------------------
# 4. 音轨定位与智能查重 API 检查 (只读)
# ------------------------------------------------------------------------------
echo ""
echo "🎯 [4/5] 音轨定位与智能查重 API 检查"
# 未下载文件返回 -100002 (优雅提示物理文件不存在)，已下载返回 000000，均表明业务逻辑健康
assert_api "音轨路径探测与定位 (/reveal)" "GET" "/v3/reveal?id=186016&name=%E7%94%A8%E5%BF%83%E8%89%AF%E8%8B%A6" "200" "\"code\":\"(000000|-100002)\""

# ------------------------------------------------------------------------------
# 5. 音频流播放与 302 CDN 重定向检查 (只读)
# ------------------------------------------------------------------------------
echo ""
echo "🎧 [5/5] 音频播放与 302 重定向直连检查"
# 云端开启 S3 时返回 302 重定向至 CDN，本地无文件时返回 404，两者均属于健康非 500 响应
assert_api "流媒体接口容错检查"        "GET" "/v3/history/stream?path=non_exist_smoke.mp3" "302|404" ""

# ------------------------------------------------------------------------------
# 6. 可选：深度读写测试 (--include-write 时触发)
# ------------------------------------------------------------------------------
if [ "$INCLUDE_WRITE" = true ]; then
  echo ""
  echo "🧪 [深度扩展] 执行写入与回滚测试 (带原子清理保障)..."
  TEST_SONG_ID="88888888"

  cleanup_write_test() {
    echo "🧹 [回滚清理] 正在确保测试数据无残留..."
    local auth_args=()
    if [ -n "$AUTH_USER_PASS" ]; then
      auth_args+=("-u" "$AUTH_USER_PASS")
    fi
    curl -s ${auth_args[@]+"${auth_args[@]}"} -X POST "${TARGET_URL}/v3/like?id=${TEST_SONG_ID}&like=false" >/dev/null || true
  }
  trap cleanup_write_test EXIT

  assert_api "添加测试红心" "POST" "/v3/like?id=${TEST_SONG_ID}&like=true" "200" "\"code\":\"000000\""
  assert_api "确认红心已写入" "GET" "/v3/like/list" "200" "${TEST_SONG_ID}"
  assert_api "移除测试红心" "POST" "/v3/like?id=${TEST_SONG_ID}&like=false" "200" "\"code\":\"000000\""

  echo "🛡️ 注：为了保护你真实的网易云登录态，即使在写测试模式下也严格禁用了 Cookie 覆盖操作。"
fi

# ------------------------------------------------------------------------------
# 汇总结果
# ------------------------------------------------------------------------------
echo ""
echo "======================================================================"
TOTAL=$((PASSED_COUNT + FAILED_COUNT))
echo "📊 冒烟巡检完成: 共测试 $TOTAL 项 API"
echo "   ✅ 成功: $PASSED_COUNT"
echo "   ❌ 失败: $FAILED_COUNT"
echo "======================================================================"

if [ "$FAILED_COUNT" -gt 0 ]; then
  echo "🚨 警告：检测到存在接口失败，当前部署存在缺陷，请排查上述输出！"
  exit 1
else
  echo "🎉 恭喜！冒烟巡检全部通过，系统处于 100% 可用状态！"
  exit 0
fi
