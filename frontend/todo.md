# Tailwind CSS 迁移计划 — `style.svelte.css` 废除

> 目标：将 `frontend/src/style.svelte.css`（4709 行 / 115 KB）完全替换为 Tailwind v4 方案。  
> 保留内容：CSS 变量 Token 系统、动画 @keyframes、`:root`/`[data-theme]` 主题体系。

---

## 0. 前置确认（选型）

| 问题 | 决策 |
|---|---|
| Tailwind 版本 | **v4**（Vite 原生插件，零 config，`@import "tailwindcss"`） |
| 是否保留 CSS 变量 Token | **是**，token 层迁入 `src/tokens.css`，供 TW 自定义属性及少量保留 CSS 类调用 |
| 是否使用 `@layer components` | **是**，只针对无法用工具类完美还原的复杂动画/伪类/状态组合 |
| 是否废除 `app.css` | **是**（该文件是 Vite 脚手架残留，与本 App 无关，一并清理） |

---

## 阶段 1 — 安装 & 接入 Tailwind v4

- [x] 安装依赖
  ```bash
  cd frontend
  npm install -D tailwindcss @tailwindcss/vite
  ```
- [x] 修改 `vite.config.ts`：`plugins: [svelte(), tailwindcss()]`
- [x] 新建 `src/app.css`（唯一全局 CSS 入口）
  ```css
  @import "tailwindcss";
  @import "./tokens.css";
  @import "./animations.css";
  @import "./base.css";
  @import "./components.css";
  @import "./style.svelte.css";
  ```
- [x] 修改 `src/main.ts`：`import './app.css'`（替换旧 style.svelte.css）
- [x] 删除旧的 `src/app.css`（Vite 脚手架残留版）
- [x] **验证**：`npm run build` & `npm run check` 编译无报错，TW 工具类生效

---

## 阶段 2 — 提取 Token 层（不动组件）

- [x] 新建 `src/tokens.css`
  - 复制 `style.svelte.css` L1-L144 的 `:root,[data-theme="dark"]` 及 `[data-theme="light"]` 块
  - 追加 Tailwind v4 的 `@theme` 扩展，将 token 映射为 TW 自定义属性：
    ```css
    @theme {
      --color-primary: var(--primary-color);
      --color-bg: var(--bg-color);
      --radius-lg: var(--radius-lg);
    }
    ```
- [x] **验证**：dark/light/auto 三态主题切换视觉无变化

---

## 阶段 3 — 提取保留层（Animations + Components）

### `src/animations.css` — 提取所有 @keyframes（约 20 个）
- [x] `spin`, `heartPulse`, `pulse-ring`, `drawerBadgePulse`
- [x] `modalBackdropFadeIn`, `modalScaleIn`, `drawerSlideUpPC/SP`, `drawerFadeIn`
- [x] `toast-fade-in`, `toast-fade-out`
- [x] `bar-slide-up`, `actionSheetFadeIn/Out`, `actionSheetSlideUp/Down`
- [x] `peqOverlayFadeIn`, `peqModalPopIn`

### `src/components.css` — `@layer components` 保留的无法 TW 化的组合类

| 保留类 | 原因 |
|---|---|
| `.track-item-card.is-active-playing` | 多状态 + `!important` 覆写 |
| `.lrc-line.active` | 动态 transform + text-shadow + font-size 三联 |
| `.progress-bar-wrapper:hover .progress-bar-*` | 嵌套子元素状态联动 |
| `.tree-node-row` padding-left calc(var(--tree-level)) | CSS 变量动态缩进，TW 无法表达 |
| `@media (display-mode: standalone)` safe-area | 特殊媒体查询 |
| 移动端 `@media(max-width:768px)` 内 `!important` 强覆写块 | 迁移期暂保留 |

- [x] 新建 `src/components.css`，完成上述迁移

---

## 阶段 4 — 组件级 Tailwind 化（主要工作量）

按组件逐一替换 class 属性，从全局 CSS 类改为 TW 工具类。

### 4-A 全局布局 & TopBar
- [x] `src/App.svelte` — Toast 容器、ActionSheet（无残留）
- [x] `src/components/TopBar.svelte` — 顶栏胶囊、品牌、导航 Tab、主题切换（纯 Tailwind 化，清除组件内 <style>）

映射示例：
```
.app-top-bar   → max-w-[900px] mx-auto mb-4 px-3 py-1.5 bg-[var(--topbar-bg)] backdrop-blur-md rounded-[26px] shadow-md border border-[var(--topbar-border)] flex items-center justify-between gap-2.5 transition-all
.nav-tab-btn   → flex-1 bg-transparent border-none px-3 py-1.5 rounded-[16px] text-[13px] font-semibold text-[var(--text-secondary)] cursor-pointer whitespace-nowrap transition-all
```

### 4-B 手风琴卡片
- [x] `PlaylistTab.svelte` — 手风琴列表、歌单 header、按钮组（抽象出 AccordionCard + DetailHeaderCard）
- [x] `SearchTab.svelte` — 手风琴、搜索栏、单选过滤组、专辑详情卡片（抽象出 DetailHeaderCard）
- [x] `DownloadMgrTab.svelte` & `HistoryTab.svelte` — 统一接入 AccordionCard，彻底清空 style.svelte.css 中的 `.accordion-*` 与 `.detail-header-card`

```
.accordion-card   → bg-[var(--card-bg)] backdrop-blur-sm rounded-[16px] shadow-md overflow-hidden border border-[var(--border-color)] transition-all
.accordion-header → px-5 py-3.5 bg-[var(--card-header-bg)] cursor-pointer flex justify-between items-center select-none hover:bg-[var(--card-header-hover)]
```

### 4-C 轨道列表行（统一 Slot 按钮系统）
- [x] `PlaylistTab.svelte` — 轨道行（抽象出 SlotBtn + TrackLikeBtn，彻底删除组件 `<style>`）
- [x] `SearchTab.svelte` — 轨道行、专辑/歌手/歌单结果行（统一 SlotBtn + TrackLikeBtn）
- [x] `DownloadMgrTab.svelte` & `FolderNode.svelte` — 轨道行、下载列表与文件夹树按钮（接入 SlotBtn）
- [x] `components.css` — 封装 `.track-item-card`、`.track-title-row`、`.track-action-group` 响应式两段布局
- [x] `style.svelte.css` — 彻底废除并删除 `.track-btn-slot`、`.jump-link-btn`、`.track-like-btn` 及其桌面/移动端全部规则

```
.track-btn-slot    → min-w-[64px] h-7 px-2.5 rounded-[14px] text-xs font-medium inline-flex items-center justify-center whitespace-nowrap bg-[var(--btn-slot-bg)] border border-[var(--btn-slot-border)] text-[var(--btn-slot-color)] transition-all hover:bg-[var(--btn-slot-hover-bg)] hover:-translate-y-px
.track-action-group → inline-flex items-center gap-1.5 shrink-0
.jump-link-btn     → bg-[var(--btn-slot-bg)] border border-[var(--btn-slot-border)] px-2.5 py-1 rounded-[12px] text-xs font-medium inline-flex items-center gap-1 transition-all hover:-translate-y-px no-underline ml-1.5
```

### 4-D 浮动下载监控组件
- [x] `PlaylistDrawer.svelte` — 抽象出 `TaskStatusBadge.svelte`，将任务列表项重构为 Tailwind flex 布局
- [x] `style.svelte.css` — 彻底删除遗留的 `.floating-monitor`、`.monitor-task-*`、`.badge`、`.badge-*` 规则（共 134 行）

```
.floating-monitor → fixed bottom-[85px] right-6 w-[360px] bg-[var(--monitor-bg)] backdrop-blur-md border border-[var(--border-color)] shadow-xl rounded-[16px] z-[9999] overflow-hidden transition-all
.badge            → px-2 py-0.5 rounded-[10px] text-[10px] font-semibold uppercase text-white
```

### 4-E 播放器栏（⚠️ 最复杂区域）
- [x] 抽象出通用细粒度组件：`PlayerCoverRing.svelte`、`PlayerProgressBar.svelte`、`PlayerControls.svelte`
- [x] `PlayerBarDesktop.svelte` — 彻底废除 350 行 `<style>` 标签，全站三段式布局纯 Tailwind 化（代码降至 144 行）
- [x] `PlayerBarMobile.svelte` — 彻底废除 115 行 `<style>` 标签，移动端 safe-area 避让与竖立音量弹窗纯 Tailwind 化（代码降至 160 行）
- [x] `style.svelte.css` — 彻底删除遗留的 `.bottom-audio-bar`、`.ctrl-btn`、`.audio-*` 等全套规则（共 535 行）

```
.bottom-audio-bar  → fixed bottom-0 left-0 right-0 h-[72px] bg-[rgba(15,23,42,0.96)] backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.4)] z-[9998] px-6 flex items-center transition-all
.ctrl-btn.play-main-btn → w-[38px] h-[38px] rounded-full bg-[#ef4444] text-white text-base shadow-[0_4px_14px_rgba(239,68,68,0.4)] flex items-center justify-center hover:scale-[1.08] hover:bg-[#dc2626]
```

### 4-F 模态框系统
- [x] 新增通用组件 `Modal.svelte`（毛玻璃背景蒙层、圆角微光拟态、Esc/Outside 关闭支持）
- [x] `RevealModal.svelte` — 彻底废除 100 行 `<style>` 标签，终端直达复制卡片纯 Tailwind 化（代码降至 109 行）
- [x] `CreatePlaylistModal.svelte` — 接入 `Modal.svelte`，清理全部行内硬编码样式并消灭 a11y 警告
- [x] `LyricModal.svelte` — 彻底废除 160 行 `<style>` 标签，全屏黑胶旋转与滚动歌词纯 Tailwind 化（代码降至 260 行）
- [x] `DownloadMgrTab.svelte` — 异常文件清单弹窗接入 `Modal.svelte`
- [x] `style.svelte.css` — 彻底删除遗留的 `.app-modal-*`、`.lyric-modal-*`、`.fullscreen-*` 全套规则（共 584 行）

```
.app-modal-backdrop → fixed inset-0 w-screen h-screen bg-black/65 backdrop-blur-[8px] z-[100000] flex items-center justify-center p-4
.app-modal-card     → bg-[rgba(15,23,42,0.96)] border border-white/[0.18] rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.7)] w-full max-w-[460px]
.app-modal-btn      → px-4 py-[7px] rounded-[8px] text-[13px] font-medium cursor-pointer transition-all border border-transparent
```

### 4-G 抽屉系统
- [x] `PlaylistDrawer.svelte` — PC 右下微光弹窗 + SP 底部升起 Bottom Sheet 双形态纯 Tailwind 化，接入 `TrackLikeBtn`
- [x] `PeqDrawer.svelte` — 彻底废除 290 行 `<style>` 标签，5段频率/增益/Q调节与响应曲线纯 Tailwind 化（代码降至 184 行）
- [x] `style.svelte.css` — 彻底删除遗留的 `.playlist-drawer-*`、`.peq-drawer-*`、`.monitor-header`、旧版 `.like-btn` 等规则（共 442 行）

### 4-H 本地曲库文件夹树
- [ ] `FolderExplorer.svelte` — 工具栏、根节点按钮
- [ ] `FolderNode.svelte` — 递归树节点行、操作按钮组

> ⚠️ `padding-left: calc(12px + var(--tree-level,0)*18px)` 保留在 `components.css`（动态 CSS 变量计算）

### 4-I 历史记录
- [ ] `HistoryTab.svelte` — 历史卡片两段式布局、状态 badge、操作按钮

### 4-J Toast 系统
- [ ] `App.svelte` — Toast 容器与各状态项（warning/info/success/error）

```
.toast-container → fixed top-[calc(18px+env(safe-area-inset-top,0px))] right-[calc(18px+env(safe-area-inset-right,0px))] z-[999999] flex flex-col items-end gap-2 pointer-events-none
.toast-item      → pointer-events-auto inline-flex items-center gap-2 px-4 py-[9px] rounded-[50px] text-[13.5px] font-semibold backdrop-blur-md
```

### 4-K ActionSheet 全局操作菜单
- [ ] 各组件 / `App.svelte` 内 `.action-sheet-*` 全套

---

## 阶段 5 — 清理 & 验证

- [ ] 删除 `src/style.svelte.css`（核心目标）
- [ ] 审查 `src/components.css` 中是否有进一步可 TW 化的规则
- [ ] `npm run build` 无报错，产物 CSS 体积 < 30 KB gzip（当前未压缩 115 KB）
- [ ] 桌面端（1280px）视觉回归：全 Tab 逐一核对
- [ ] 移动端（375px）视觉回归：PlayerBar、Drawer、ActionSheet
- [ ] PWA standalone safe-area 检查（iOS Safari）
- [ ] 深色 / 浅色 / 自动 三态主题切换验证
- [ ] `npm run test:e2e` 全绿

---

## 风险 & 注意事项

### ⚠️ `!important` 地狱
`style.svelte.css` 移动端响应式段含大量 `!important` 强覆写。迁移时若 TW 工具类优先级不足，使用 TW v4 的 `important:` 修饰符（如 `important:flex-col`）或在 `@layer utilities` 中声明。

### ⚠️ 动态 CSS 变量 `--tree-level`
`FolderNode.svelte` 通过 `style="--tree-level:{depth}"` 内联驱动缩进，TW 无法表达，必须保留在 `components.css`。

### ⚠️ `env(safe-area-inset-*)` 计算值
所有含 `calc(Npx + env(...))` 的移动端 safe-area 规则，需写在 `components.css` 或内联 style，TW v4 原生不支持。

### 📝 Svelte scoped style 共存
迁移期间部分组件可保留 `<style>` 块作为过渡，不必强求全 TW。清理 style.svelte.css 后再视情况去除。

### 📝 `app.css` 旧文件
当前 `src/app.css` 是 Vite 脚手架初始模板（未被 `main.ts` 引用），可直接删除不影响运行。

---

## 文件结构目标（迁移后）

```
frontend/src/
├── main.ts              ← import './app.css'（唯一入口）
├── app.css              ← @import tailwindcss + 各分层文件
├── tokens.css           ← :root / [data-theme] CSS 变量 Token
├── animations.css       ← 所有 @keyframes（约 20 个）
├── base.css             ← html/body reset + PWA safe-area
├── components.css       ← @layer components：保留的复杂组合类
└── style.svelte.css     ← ❌ 删除
```

---

## 工时估算

| 阶段 | 预计时间 |
|---|---|
| 阶段 1（安装接入） | 0.5h |
| 阶段 2（Token 层） | 0.5h |
| 阶段 3（动画 + Components） | 1h |
| 阶段 4-A~D（布局/轨道/监控/播放器） | 4h |
| 阶段 4-E~K（模态/抽屉/历史/Toast/AS） | 4h |
| 阶段 5（清理验证） | 1h |
| **合计** | **~11h** |
