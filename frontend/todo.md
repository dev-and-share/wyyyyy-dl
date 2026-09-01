# wyyyyy-dl 前端 TODO（Svelte 5 版本）

> Tailwind 迁移计划已 100% 完成并归档。本文件为迁移后的持续优化清单。

---

## 🐛 Bug & 体验问题

- [x] **PlaylistTab：歌单搜索 input 未随路由切换清空**
  - 完成：`hashchange` 监听解析 `id=...` 路由参数并与 `pid`/`pidInput` 双向绑定同步。
- [x] **PlaylistDrawer / PeqDrawer 关闭时无退出动画**
  - 完成：在移动端与桌面端分别接入 `drawerSlideDownSP` / `drawerSlideDownPC` 逆向退出平滑过渡。
- [x] **均衡器（PEQ）参数修改后刷新页面恢复默认**
  - 完成：使用 `localStorage` 自动序列化 `bands[]` 和启用状态，onMount 自动恢复。

---

## ✨ 功能增强

- [x] **手势支持：Bottom Sheet 可下滑关闭**
  - 完成：`PlaylistDrawer`、`PeqDrawer`、`BottomSheet` 均已接入顶部手势指示条与 `touch` 拖拽下拉交互，释放超过阈值平滑关闭。
- [x] **搜索结果支持歌单批量下载**
  - 完成：在搜索歌单列表行添加 `📥 下载整单` 操作按钮，调用 `api.downloadPlaylist` 并自动触发任务轮询。
- [x] **离线模式增强：显示可播放曲目数量**
  - 完成：`offlineOnly` 开启时，播放队列标签显示 `(本地 N 首 / 全部 M 首)`。
- [x] **播放进度条 PC 端 hover 时间预览**
  - 完成：鼠标 hover 进度条时在上方精确显示对应位置的时间戳气泡。
- [x] **歌词滚动优化**
  - 完成：手动点击歌词跳转时暂停自动居中滚动 3 秒，防止抢夺用户视觉焦点。

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
