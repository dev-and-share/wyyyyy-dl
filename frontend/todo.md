# wyyyyy-dl 前端 TODO（Svelte 5 版本）

> Tailwind 迁移计划已 100% 完成并归档。本文件为迁移后的持续优化清单。

---

## 🐛 Bug & 体验问题

- [ ] **PlaylistTab：歌单搜索 input 未随路由切换清空**
  - 复现：点击歌单 A 加载详情 → 点击歌单 B → input 依然保留 A 的 id，几秒后轮询回退
  - 根因：`searchInput` 状态未与路由/歌单 id 绑定重置
- [ ] **PlaylistDrawer / PeqDrawer 关闭时无退出动画**
  - 当前：打开有 `drawerSlideUpSP` 入场动画，关闭是瞬间消失（`{#if}` 直接卸载）
  - 方案：用 Svelte 5 `transition:` 指令 或 `onDestroy` + CSS `animating` class 做退出过渡
- [ ] **均衡器（PEQ）参数修改后刷新页面恢复默认**
  - 当前：PEQ 参数仅存 AudioContext 内存，无持久化
  - 方案：`localStorage` 序列化 `bands[]`，onMount 恢复

---

## ✨ 功能增强

- [ ] **手势支持：Bottom Sheet 可上划关闭**
  - PlaylistDrawer / PeqDrawer / BottomSheet 添加 `touchstart/touchmove/touchend` 手势拖拽关闭
  - 阈值：下划超过 120px 触发关闭动画 + 卸载
- [ ] **搜索结果支持歌单批量下载**
  - 搜索歌单列表行添加"📥 下载整单"按钮，调用 `api.downloadPlaylist`
- [ ] **离线模式增强：显示可播放曲目数量**
  - `offlineOnly` 开启时，播放队列角标显示 `本地 N 首 / 全部 M 首`
- [ ] **播放进度条 PC 端 hover 缩略图预览**
  - hover 进度条时，气泡内显示当前时间（已有基础，可优化为带时间戳的 tooltip）
- [ ] **歌词滚动优化**
  - 手动点击歌词跳转后，停止自动滚动 3s（防止立刻被自动滚回去盖掉用户意图）

---

## 🏗️ 架构 & 代码质量

- [x] **全站最后一个组件 `<style>` 标签清理：`PlayerBar.svelte`**
  - 完成：已将 `PlayerBar.svelte` 的 114 行 `<style>` 全部替换为 Tailwind 工具类，实现全站所有 `.svelte` 组件 **100% 纯 Tailwind、零 `<style>` 标签**！
- [ ] **`SearchTab.svelte` 行数过长风险**
  - 当前约 417 行（接近 500 行限制），建议拆出 `AlbumDetailCard.svelte`（专辑展开视图）
- [ ] **`DownloadMgrTab.svelte` 存在多个 `<span onclick>` a11y warn**
  - 22 条 svelte-check warning 中有 9 条来自此文件的 `<span>/<strong>` onclick
  - 方案：统一替换为 `<button type="button" class="...">`
- [ ] **`playerHelper.ts` 重复调用 `api.songV1`**
  - `resolveTrackUrl` 内部有两次 `api.songV1` 调用（一次 side-effect 火后即忘，一次 await）
  - 优化为单次请求，先 await 拿结果再统一处理封面/歌词/url
- [ ] **`BottomSheet.svelte` 缺少退出动画**
  - FolderNode 的操作菜单关闭是瞬间消失，与 PlaylistDrawer 的体验不一致
- [ ] **全站 `a11y_no_noninteractive_element_interactions` warnings 修复**
  - 当前 svelte-check 22 条 warnings（均为 a11y）需逐步清理

---

## 🚀 性能

- [ ] **PlaylistTab 歌单曲目列表虚拟滚动**
  - 大歌单（500+ 首）渲染所有 `<li>` 节点会导致明显卡顿
  - 方案：接入 `svelte-virtual-list` 或手写 `intersection-observer` 懒渲染
- [ ] **API 请求去重/防抖**
  - `fetchTasks` 轮询 3s 一次，但用户快速切换 Tab 时可能触发多次 `startTaskPolling()`
  - 当前有 `if (taskTimer !== null) return` 保护，验证是否足够

---

## 📱 移动端体验

- [ ] **PlaylistDrawer Bottom Sheet 支持手势下滑关闭**（见手势支持条目）
- [ ] **iOS Safari 底部安全区在 PWA standalone 模式验证**
  - 当前 `env(safe-area-inset-bottom)` 规则存在，但未在真机 PWA 场景下完整回归

---

## 🐳 Docker & 部署

- [ ] **`compose --build` 增量缓存分层优化**
  - 前端 `npm ci` 和 `vite build` 应分两层，避免代码变更触发全量 npm 安装
- [ ] **Svelte 版前端静态产物路径更新**
  - 确认 `static/svelte/` 输出目录与 Spring Boot `/svelte/**` 路由映射一致

---

_最后更新：2026-09-02_
