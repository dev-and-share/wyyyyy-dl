# AGENTS.md — 架构导航

> 本项目已彻底移除旧版 Vanilla JS 与精简版模式，全面统一为 **Svelte 5 (Vite + Tailwind v4 + Runes) + Spring Boot 3** 现代化架构。

- **核心技术栈手册**：`./AGENTS_svelte.md` — Runes 状态拆分、组件单文件 <500 行规范、桌面宽屏分栏与 SP 自适应、自动化测试。
- **Java 后端规范**：Spring Boot 3.2.5 + JDK 21，所有业务与流媒体接口收口至 `/v3/` 规范。

**快速路由：**

| 你要做什么 | 看哪份 / 路径 |
|---|---|
| 前端界面、组件、Stores、样式 | `frontend/src/*`，参考 `AGENTS_svelte.md` |
| 后端 API、Service、SQLite DAO | `src/main/java/com/pewee/...` |
| 构建与部署 | 根目录 `./deploy.sh` 或 `Dockerfile` |
