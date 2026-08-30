# AGENTS.md — 路由导航

> 本项目双栈并存，按任务选对应手册，**不要混用**。

- **旧版 vanilla JS（Thymeleaf + 11 JS）**：`./AGENTS_js.md` — 历次重构沉淀的硬核避坑（DAO/status、SWR、PWA、SP 适配、拖拽、Docker `v4.6.7`）。
- **新版 Svelte 5（Vite + Runes）**：`./AGENTS_svelte.md` — 选型/双版 `?v/Cookie` 隔离、`Runes` 拆分、样式复用、5 阶段收口、组件测试。

**快速路由：**

| 你要做什么 | 看哪份 |
|---|---|
| 修/增旧版 `static/js`、`home.html`、`DownloadHistoryDAO` | `AGENTS_js.md` |
| 修/增新版 `frontend/src/*`、`static/svelte`、`QrLoginController ?v` | `AGENTS_svelte.md` |
| 双版切换、Docker 多段、`compose --build` | `AGENTS_svelte.md` §2 |
| 加新功能前必查 | 两份的“新增功能必查清单”都要过 |

> 新需求默认走 **Svelte 版**，旧版仅修 Bug。`feature/svelte5-migration` 为当前主战场，`8080/?v=svelte` 新版，`?v=legacy` 秒回旧版。
