# PC 桌面级分栏布局改版开发落地计划

> **分支**：`feature/pc-desktop-layout`（从 `refactor/tailwind-migration` 切出）
> **目标**：在 PC 宽屏（>= 1024px）下，将当前"单列折叠手风琴"布局升级为「左侧导航边栏 + 右侧宽屏主工作区」的专业桌面级体验，**手机端 SP 体验完全保留，零改动**。

---

## 版本定位

| 版本层次 | 描述 | 切换入口 |
|---|---|---|
| 纯 JS 旧版（原始版）| 已基本弃用，命不久矣 | `?v=legacy`（后端 Cookie 路由） |
| **Svelte 当前版（现役精简版）** | 当前 `refactor/tailwind-migration` 的 Tab 折叠手风琴版，SP 已深度打磨 | `[↩️ 切换精简版]` 按钮 |
| **Svelte 新版（本分支目标）** | 桌面级左右分栏，SP 行为不变 | 默认打开即为新版 |

> 注意：原来 `TopBar` 里的 `[↩️ 旧版]` 按钮目前调用 `switchToLegacy()` 跳到 JS 纯版。
> **本次改版后**，该按钮语义改为"切换到 Svelte 精简版（Tab 折叠模式）"，通过
> `localStorage` 的 `wyyyy_pc_layout` 标志实现，**不再依赖 Cookie/URL 的 `?v=legacy`**。

---

## 核心原则（红线，不得逾越）

1. **SP 绝不动**：手机端（< 1024px）的 `BottomTabBar`、`PlayerBarMobile`、`PullToRefresh`、下拉刷新手势、安全区 padding 等所有 SP 相关代码**一律不触碰**。
2. **响应式隔离**：新增的桌面级布局逻辑**全部通过 `>= 1024px` 的 CSS 媒体查询或 `isDesktop` Rune 来激活**，窄屏时自动退回现有布局，如同它从未存在。
3. **现有组件优先复用**：`PlaylistTab`、`SearchTab`、`DownloadMgrTab`、`MyPlaylistsSection`、`GlobalAudioPlayer` 等**不拆解、不重写**，只在外层做包装和布局组合。
4. **500 行文件限制**：新组件全部遵守现有 `check:lines` 校验（每个 `.svelte` 文件 <= 500 行）。

---

## 最终目标布局（线框速览）

```
PC 宽屏（>= 1024px）：
+------------------------------------------------------------------------------+
| [左侧 Sidebar 220px]  |  [顶部 DesktopHeader]                                |
|                       |  [<][>]  [ 粘贴链接/搜索... ]     [主题][重复][精简版] |
|                       +------------------------------------------------------+
| 网易云下载器 [«]      |                                                        |
| AndyF [VIP]           |  【右侧主内容区 Main Stage（宽屏舒展）】               |
|                       |                                                        |
| [主导航]              |  歌单 Tab -> 状态A: 歌单封面画廊 (4~5列网格)           |
| 📁 歌单（当前）       |             状态B: 歌单详情 + 歌曲宽屏大表格           |
| 🔍 搜索               |  搜索 Tab -> 关键词搜索结果 + 专辑/歌手详情            |
| 📥 本地 (下载中: 2)   |  本地 Tab -> 左侧目录树 + 右侧历史列表（双栏）         |
|                       |                                                        |
| [我的歌单（可滚动）]  |                                                        |
|  + 新建歌单           |                                                        |
|  ❤️ 我喜欢的音乐      |                                                        |
|  📂 周杰伦全集        |                                                        |
|  -- 收藏歌单 --       |                                                        |
|  🎵 摇滚宝藏          |                                                        |
|                       |                                                        |
| [底部工具]            |                                                        |
|  [二维码登录]         |                                                        |
|  [↩️ 切换精简版]      |                                                        |
+------------------------------------------------------------------------------+
|   [底栏播放器 GlobalAudioPlayer — 全宽常驻，SP/PC 共用，完全不改]            |
+------------------------------------------------------------------------------+

手机端（< 1024px）：行为与现在完全一致，本次改动透明。
```

---

## 阶段计划

### 阶段 0：基础设施准备（前置，无视觉变化）

**目标**：新增 PC 布局模式的基础判断与持久化，不影响任何现有渲染。

#### 0-1. `src/lib/layout.svelte.ts`（新建）

```typescript
export type PcLayoutMode = 'desktop-sidebar' | 'legacy-tabs';

export function getInitialPcLayout(): PcLayoutMode {
  const v = localStorage.getItem('wyyyy_pc_layout');
  if (v === 'legacy-tabs') return 'legacy-tabs';
  return 'desktop-sidebar';
}

// 切换到精简 Tab 模式（不再跳转到纯 JS 版，仅 localStorage 控制）
export function switchToLegacyTabs() {
  localStorage.setItem('wyyyy_pc_layout', 'legacy-tabs');
  window.location.reload();
}

export function switchToDesktopSidebar() {
  localStorage.setItem('wyyyy_pc_layout', 'desktop-sidebar');
  window.location.reload();
}
```

#### 0-2. `src/lib/router.svelte.ts`（微调）

- 在现有 `routerState` 里增加 `sidebarCollapsed: boolean`，持久化到 `localStorage`。
- **不改任何 SP 路由逻辑**。

---

### 阶段 1：左侧边栏组件（仅 PC 渲染）

**目标**：新建 `DesktopSidebar.svelte`，在 `< 1024px` 时完全不渲染（`hidden lg:flex`）。

#### `src/components/DesktopSidebar.svelte`（新建，<= 500 行）

**负责内容**：

- Logo 区 + 折叠/展开按钮（`«`/`»`），展开宽 220px，折叠至 56px 纯图标模式
- 三大主导航按钮：📁 歌单 / 🔍 搜索 / 📥 本地（带正在下载任务数徽标）
- "我的歌单"列表（**复用 `myPlaylists` store，无额外 API 调用**）：
  - 创建的歌单（可滚动，带新建 `[+]` 按钮）
  - 收藏的歌单（同上）
  - 点击歌单 -> 调用 `onViewPlaylist(id)` prop
- 底部区：账号信息/二维码登录入口 + `[↩️ 切换精简版]` 按钮

**Props 接口**：

```typescript
{
  tab: 'playlist' | 'search' | 'download-mgr';
  collapsed: boolean;
  downloadingCount: number;
  onSwitchTab: (tab: 'playlist' | 'search' | 'download-mgr') => void;
  onViewPlaylist: (id: string) => void;
  onToggleCollapse: () => void;
  onSwitchToLegacyTabs: () => void;
  showToast: (m: string, t?: string) => void;
}
```

**宽度过渡**：`transition: width 250ms ease`，展开 `lg:w-[220px]` / 折叠 `lg:w-[56px]`。

---

### 阶段 2：顶部 Desktop Header 改造（PC 专用）

**方案**：在现有 `TopBar.svelte` 内用 `lg:` 媒体隔离区分渲染（**不新建 TopBar 组件**）。

**PC 模式顶部新增（`lg:flex` 激活）**：

- 左：历史导航占位（初版留坑）
- 中：全能统一输入框（宽 `max-w-[560px]`）：
  - 粘贴歌单/单曲链接或 ID -> 自动识别并触发对应解析
  - 输入文字 -> 跳转搜索 Tab 并触发搜索
- 右：`[主题切换]` `[允许重复]` `[↩️ 精简版]`

**SP 模式顶部（`lg:hidden`）**：完全保留现有代码，一行不改。

---

### 阶段 3：App.svelte 主布局骨架切换

**核心策略：增量双骨架，原有代码块原封不动**

```svelte
<!-- 新增：PC 桌面宽屏外壳（手机端通过 hidden lg:flex 完全隐藏） -->
{#if pcLayoutMode === 'desktop-sidebar'}
  <div class="hidden lg:flex h-screen overflow-hidden">
    <DesktopSidebar {tab} {sidebarCollapsed} {downloadingCount}
      onSwitchTab={switchTab} onViewPlaylist={jumpToPlaylist}
      onToggleCollapse={toggleSidebar}
      onSwitchToLegacyTabs={switchToLegacyTabs} {showToast}
    />
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <TopBar ... />   <!-- TopBar 内部 lg: 分支自动切换 PC 样式 -->
      <main class="flex-1 overflow-y-auto px-6 py-4">
        <div style="display:{tab==='playlist'?'contents':'none'}"><PlaylistTab .../></div>
        <div style="display:{tab==='search'?'contents':'none'}"><SearchTab .../></div>
        <div style="display:{tab==='download-mgr'?'contents':'none'}"><DownloadMgrTab .../></div>
      </main>
    </div>
  </div>
{/if}

<!-- 原有布局：SP 始终走这里，PC 精简版也走这里（一行代码不改） -->
<div class="{pcLayoutMode === 'desktop-sidebar' ? 'lg:hidden' : ''}">
  <!-- ===== 完全是现在的代码 ===== -->
  <TopBar ... />
  <div class="max-w-[900px] mx-auto ...">
    <PlaylistTab ... />  <SearchTab ... />  <DownloadMgrTab ... />
  </div>
</div>
```

> **关键保障**：手机端 `lg:hidden` 在 < 1024px 下不生效，原有布局 DOM 照常渲染，SP 行为完全不变。

---

### 阶段 4：右侧主内容区核心交互细节

#### 4-A：歌单 Tab — Gallery 画廊 <-> Detail 详情双状态

**Gallery View（初始，未选歌单）**：

- 右侧上方：快捷解析输入条（从 `PlaylistTab` 现有输入框逻辑提取）
- 右侧主体：渲染 `MyPlaylistsSection` 的歌单封面网格
  - 自适应列数：`grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
  - 数据来自现有 `myPlaylists` store，无额外 API
  - 加载中显示 SkeletonCard 骨架占位，**永不出现大空白**

**Detail View（点击歌单后）**：

- 顶部面包屑：`[< 返回我的歌单]` + 歌单名
- 歌单 Hero 横幅：封面 + 歌单名 + 歌曲总数/已下载数 + 操作区（播放全部、批量下载音质选择、全选）
- 主体：**复用 `PlaylistTab` 现有歌曲列表渲染**，宽度自然撑满（不受 900px 限制）
- `thead` 用 `position: sticky; top: 0;` 吸顶

**状态切换**：左侧边栏点击歌单 -> `onViewPlaylist(id)` -> `playlistViewMode = 'detail'` + `pid = id`，Rune 自动触发。

#### 4-B：搜索 Tab — 宽屏直铺，初始不空

**未搜索时**：

- 搜索类型切换器：`[单曲] [专辑] [歌单] [歌手]`
- 最近搜索历史标签（localStorage，带清空按钮）
- 最近查看的专辑/歌手 Detail 卡片（复用已有的 `AlbumDetailCard` / `ArtistDetailCard`）

**搜索结果（宽屏）**：

- 单曲结果：全宽列表，展示更多字段（专辑名、音质标签）
- 专辑/歌单结果：`grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` 自适应卡片

#### 4-C：本地 Tab — 桌面级双栏工作台

PC 宽屏下，`DownloadMgrTab` 区域拆分为左右并排（仅 PC，通过 `lg:` 激活）：

- **左侧 40%**：`FolderExplorer`（本地目录树，可折叠、可点击播放/定位）
- **右侧 60%**：历史下载列表（`HistoryTab`）+ PWA 离线缓存（`BrowserCacheSection`）+ 曲库扫描工具

SP 下保持原有单列上下堆叠，`DownloadMgrTab` 内部逻辑完全不动。

---

### 阶段 5：精修与收尾

| 项目 | 内容 |
|---|---|
| 边栏折叠动画 | `width` + `opacity` CSS 过渡 250ms；折叠后仅图标，`title` tooltip 替代文字 |
| `isDesktop` Rune | `window.innerWidth >= 1024`，监听 `resize` 防抖 200ms，响应式 |
| 边栏状态记忆 | `sidebarCollapsed` 写入 `localStorage`，下次打开自动恢复 |
| Gallery 骨架屏 | 加载中展示 8 个 SkeletonCard 占位，无空白闪烁 |
| 表头吸顶 | Detail View 歌曲表格 `thead`：`sticky top-0` |
| `[↩️ 切换精简版]` | `switchToLegacyTabs()` -> localStorage -> `location.reload()` -> 走原有布局 |
| 无障碍 | 边栏折叠按钮加 `aria-label`；导航按钮键盘可聚焦 |
| 单元测试 | 新增 `DesktopSidebar.test.ts`：验证折叠/展开、Tab 切换、歌单点击 emit |

---

## 开发顺序（逐阶段可独立验证）

```
阶段 0：新建 layout.svelte.ts，router 微增字段
        -> npm run check 确认 0 错误
阶段 1：新建 DesktopSidebar.svelte（先静态结构）
        -> 1440px 下验证边栏出现，375px 下验证完全隐藏
阶段 2：TopBar 内增 lg: PC 分支
        -> 验证 PC 顶部新布局，SP 顶部丝毫不变
阶段 3：App.svelte 增 PC 外壳骨架
        -> 验证 PC 走新骨架，SP 走原有骨架
阶段 4-A：歌单 Gallery/Detail 双状态接通
阶段 4-B：搜索 Tab 宽屏布局接通
阶段 4-C：本地 Tab 双栏布局接通
阶段 5：动画、骨架屏、空态、键盘、测试

全部通过后：deploy.sh -> v4.7.0
```

---

## 受影响文件速查

### 新建（不影响现有）

- `src/components/DesktopSidebar.svelte`
- `src/lib/layout.svelte.ts`

### 修改（最小改动，精准手术）

- `src/App.svelte`：增加 PC 外壳骨架 + `pcLayoutMode` 判断（现有代码块原封不动）
- `src/components/TopBar.svelte`：内部增 `lg:` PC 分支（SP 分支 `lg:hidden` 保留不改）
- `src/lib/router.svelte.ts`：仅新增 `sidebarCollapsed` 字段，不改现有逻辑

### 绝对不改（SP 保护区）

- `src/components/BottomTabBar.svelte`
- `src/components/PlayerBarMobile.svelte`
- `src/components/PullToRefresh.svelte`
- `src/components/PlaylistTab.svelte`（内部逻辑不动，仅父容器移除 900px 限制）
- `src/components/SearchTab.svelte`（同上）
- `src/components/DownloadMgrTab.svelte`（同上）
- `src/components/GlobalAudioPlayer.svelte`
- `src/lib/theme.ts`（`switchToLegacy` 保留，仅在 `layout.svelte.ts` 新增 `switchToLegacyTabs`）

---

## 验收标准

- [ ] 1440px 宽屏下，左侧边栏可见，右侧主区域撑满，无大片死白
- [ ] 边栏展开/折叠过渡流畅（250ms），折叠后图标 + tooltip 可识别
- [ ] 左侧点击歌单 -> 右侧 Gallery/Detail 正确切换，面包屑返回正常
- [ ] 顶部统一输入框：粘贴歌单/单曲链接解析正确；输入文字跳搜索
- [ ] 本地 Tab 在 PC 下呈现目录树与历史列表双栏并排
- [ ] 375px（iPhone SE）下，页面与当前版本**像素级一致**，SP 任何功能不退步
- [ ] `npm run check`、`npm run test`、`npm run build` 全部 pass
- [ ] `deploy.sh` 可一键走完 CI + Docker 构建
