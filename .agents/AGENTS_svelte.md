# AGENTS_svelte.md — Svelte 5 迁移实战手记

> 分支 `feature/svelte5-migration`，`Spring Boot 3.2.5 + JDK21` 不动，`vanilla JS 11 文件` → `Svelte 5 Runes + Vite` 双版并存。`docker compose up -d --build` 即切 `8080`，`?v=svelte|legacy` + `Cookie ui_version` 互切，无痕回滚。

---

## 1. 为何选 Svelte 5 而非 React/Vue

- **React/Redux/Next 用腻，新鲜感**：Svelte 编译时无虚拟 DOM，`$state/$derived/$effect` 心智比 `useState/useMemo/useEffect` 直观，`.svelte` 单文件即 `HTML+JS+CSS` 原生感，最轻（`114k / 37k gzip`）。
- **不要太重**：`Vue 3` 亦轻但 Svelte 更轻，且无需 `Pinia/Vuex`，`Runes` 即 store；`SvelteKit` 过重（SSR），`Vite + @sveltejs/vite-plugin-svelte` 纯 SPA 最适配 `Thymeleaf` 托管。
- **好迁**：渐进绞杀，`static/js/*.js` 可逐个搬 `lib/*.svelte.ts` + `components/*.svelte`，`static/svelte` 隔离 `static/js`，零覆盖。

## 2. 双版并存架构

```
frontend/ (Svelte 5.56 + TS + Vite 8)
  vite.config.ts base:/svelte/ outDir:../src/main/resources/static/svelte
  → Docker 多段：node:22 build → eclipse-temurin:21-jdk bootJar → 21-jre
src/main/java/.../QrLoginController.java:36  ?v 优先于 Cookie
  /?v=svelte | Cookie svelte → forward:/svelte/index.html
  /?v=legacy → home/qr_login
  /api/ui-version?v=svelte|legacy → Set-Cookie ui_version (1y)
templates/home.html:46  🧪 试用新版  ↔  App.svelte:222 ↩️ 旧版
```

- 旧版 `home.html v4.6.7 + 11 JS + style.css` 原地不动，`git diff` 仅 `QrLoginController` + `frontend/`。
- `static/svelte` `gitignore`，镜像内自建，本地 `npm run build` 亦可。

## 3. 组件化与状态
 
- **单文件代码规模（< 500 行红线）**：所有 `.svelte` 单组件文件严格控制在 500 行以内（推荐 100~300 行）。严禁在单个文件中堆砌全量业务逻辑；按 `Tab`（`PlaylistTab / SearchTab / DownloadMgrTab`）、`Modal`（`LyricModal / RevealModal / CreatePlaylistModal`）、`Widget`（`TopBar / FloatingMonitor / PlayerBar / PeqDrawer`）进行模块化拆分。
- **Runes stores**：`lib/player.svelte.ts`（queue/qIndex/mode/volume + localStorage 持久化 + `resolveUrl` 经 `/Song_V1 lossless` 取真实流）、`playlist.svelte.ts`（`SWR pwa_api_cache_*`）、`search.svelte.ts`（`Array.isArray` 兼容 `/Search` 回 `array|object`）。
- **样式**：全量复用 `style.css` 变量（`--card-bg --input-bg` 等），类名 `app-top-bar/accordion-card/bottom-audio-bar/playlist-drawer` 1:1，`pc-only-text/sp-hide` 响应式与旧版同，`input[type=text]` 白底 bug 即 `type` 缺失所致。

## 4. 关键坑与解法

| 坑 | 解 |
|---|---|
| `8080` 复用 | 统一 `docker compose up -d --build` 直出 `8080`（OrbStack 转发），无需 `8081/18080` 绕路；本地 `bootRun` 亦 `--server.port=8080` |
| `JDK25 + Lombok` `ExceptionInInitializerError` | `JAVA_HOME=jdk-21` |
| `input` 白底 | `input` 补 `type="text"` 使 `input[type=text]` 命中 |
| `my-playlist-filter-bar` 垂直堆 | 改 `my-playlist-filter-bar + playlist-quick-btn-group + quick-btn-item` 原类 + `grid 4等分` 移动端 |
| `POST /Playlist id=123 → 还未设置cookie!` 静默 | `code≠000000` 弹 `toast(j.msg)`，`e2e` 显式断言该 `toast` |
| `?v=legacy` 被 `Cookie svelte` 劫持 | `?v` 优先于 `Cookie` |
| `Docker` 前端未进镜像 | 多段 `frontend-builder` → `jar-builder COPY --from` |
| `svelte-check` `togglePlay` 返回 `false` | `then(()=>{ if(paused) play() })` 显式 `void` |
| `vitest lifecycle_function_unavailable` | `vitest.config.ts` `server.deps.inline: [/svelte/]` + `conditions: [browser]` |

## 5. 测试策略演进

- **E2E → 组件测试**：`E2E` 强耦合 `MUSIC_U cookie`（`还未设置cookie` 仅空库命中，登录后 flaky），切 `vitest + @testing-library/svelte + jsdom` `mock api`，`CreatePlaylistModal` 3/3 稳定；`E2E` 保留 6 例作回归，`legacy` 用 `btn.or(qr)` 兼容未登录。
- **双核分屏**：`8080/?v=legacy` vs `8080/svelte` + `Playwright 1280/390` 双截图，`Network` 抓 `?type= 1/10/1000/100`。
- **自回归**：`svelte-check 0 error / npm run build / jar tf BOOT-INF/classes/static/svelte / docker buildx` 全链路。

## 6. 心得

- **轻但不简**：`Svelte` 轻在运行时，重在需补全 `PEQ` 5 段 `Canvas + Web Audio`、`Lyric` `parseLrc + scrollIntoView`、`PWA` 缓存等旧版沉淀，单文件 MVP 极易漏 `isLocal → 播放/定位`、`trackCount` 徽标、`…` 抽屉等细节，32 项矩阵逐项勾方不崩。
- **样式即契约**：复用 `style.css` 类名与 `pc-only-text` 是最低成本保 `SP` 不崩的关键，任何 `inline style` 皆可能破 `768px` 栅格。
- **先让旧版可测**：`?v`+`Cookie` 双版并存让 `legacy` 成为黄金标准，分屏对比比任何文档都高效；`tsc` 0 误差是底线，`a11y` 警告可容忍但 `code≠000000` 必须 `toast`。
- **后续**：按 `P1 歌单/搜索 → P2 播放/黑胶/PEQ → P3 队列/下载 → P4 文件/历史` 逐模块 `组件化 + 组件测试` 收口，`App.svelte` 终缩至 `<TopBar><Router><Player>` 壳。

> `docker compose up -d --build` 后 `http://localhost:8080/?v=svelte` 即新版，`?v=legacy` 秒回旧版，`/svelte/index.html` 直达。
