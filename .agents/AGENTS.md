# 🤖 AGENTS.md - 网易云音乐下载器 (netease-music-dl) 项目 Agent 避坑与行为准则

本文件整理了本项目在历次重构、数据库优化、播放器交互、移动端 SP 适配过程中沉淀的**硬核架构踩坑经验与代码准则**。后续所有 AI Agent 在修改、重构或扩充本项目代码时，**必须严格遵守以下规则**。

---

## 🗄️ 1. 数据库与 SQLite DAO 避坑准则 (`DownloadHistoryDAO.java`)

1. **`status` 状态值一致性（血泪教训）**：
   - 数据库 `download_history` 表插入记录时，默认落盘成功状态是 **`"SUCCESS"`**（而不是 `"COMPLETED"`）。
   - **硬红线**：在 SQL 查询（如 `findLocalFileBySongOrName`）中，**严禁写死 `WHERE status = 'COMPLETED'`**！
   - 文件有效性必须且仅能依赖 Java 层面的 `File.exists() && file.isFile() && file.length() > 0` 进行物理判定。

2. **智能跨专辑本地音轨比对 (0 延迟秒播)**：
   - 当用户在前端点击任何歌曲（包括同一首歌在网易云不同精选辑/专辑下的情况）时，控制器会优先调用 `findLocalFileBySongOrName(songId, name, artist)`：
     - Step 1: 优先按 `song_id` 查询；
     - Step 2: 降级匹配剥离括号/后缀后的 **歌名 + 歌手名**。
   - 匹配命中后，自动拦截线上 30 秒试听片段，返回 `/v2/stream?id=...&historyId=...` 本地无损流。

3. **多目录外部曲库支持 (`EXTERNAL_LIBRARY_PATHS`)**：
   - 环境变量 `EXTERNAL_LIBRARY_PATHS` 支持使用分号 `;` 或逗号 `,` 配置多个外部曲库路径；
   - Docker 启动时使用 `:ro` (Read-Only) 挂载外部路径，保障只读安全。

---

## 🎨 2. CSS 样式与 SP 移动端 UI 避坑准则 (`style.css` / `download-mgr.js`)

1. **高特异性覆写全局 Flex 冲突 (CSS Specificity)**：
   - 系统全局 `ul.data-list li` 带有 `display: flex; justify-content: space-between; align-items: center;` (强制水平一行)。
   - **硬红线**：定义历史列表卡片样式时，**必须使用高特异性选择器 `ul.data-list li.history-item-card` + `display: flex !important; flex-direction: column !important;`**，否则子元素会被浏览器强行单行平铺，导致歌名被挤缩。

2. **移动端 SP (Smartphone) 歌名 100% 满宽结构**：
   - 移动端列表卡片必须采用**两排物理分立结构**：
     - **第 1 排 (`.card-title-row`)**：100% 独占歌名/文件名，带有 `word-break: break-all`，**严禁在第 1 排放置任何操作按钮**，确保长歌名无遮挡全显；
     - **第 2 排 (`.card-sub-row`)**：左侧放置歌手、大小、状态标签 (`.sub-left`)，右侧放置胶囊操作按钮组 (`.sub-right`)。

3. **圆圈播放按钮光学居中**：
   - 红圈播放按钮 `.ctrl-btn.play-main-btn` **绝对不能添加 `padding-left: 2px`**！
   - 必须使用 `padding: 0 !important; line-height: 1 !important; display: inline-flex; align-items: center; justify-content: center;` 保障图标在数学与视觉上的绝对居中。

4. **iOS Safari 底部工具栏安全区防避让 (`safe-area-inset-bottom`)**：
   - 悬浮在底部的播放器 `.bottom-audio-bar` 必须包含 iOS 安全区变量避让：
     ```css
     bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important;
     padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important;
     ```
   - `home.html` 底部占位 Spacer 块必须同步抬高至 `calc(140px + env(safe-area-inset-bottom, 0px))`，防止列表底部最后一项被播放器遮挡。

---

## 🧪 3. 单元测试 (UT) 契约

1. **测试集合**：
   - 项目配有全量单元测试：
     - `DownloadHistoryDAOTest` (数据持久化、智能比对、多路径扫描测试)
     - `AnalysisControllerTest` (MockMvc 播放流拦截与搜索参数兼容测试)
     - `DownloadHistoryControllerTest` (分页与统计接口测试)
2. **测试运行要求**：
   - 每次修改核心 DAO 或 Controller 逻辑后，必须执行 `JAVA_HOME=... ./gradlew test`；
   - 保证全套测试 **100% BUILD SUCCESSFUL** 且无 Failures / Errors 后方可构建容器。

---

## 🐳 4. 构建、部署与环境规则

1. **静态资源版本号递增**：
   - 每次修改 `style.css` 或 `js/*.js` 时，必须同步递增 `home.html` 引入路径中的版本号 `?v=2.x.x`，避免浏览器强缓存导致新样式不生效。

2. **Docker 容器环境变量**：
   - Docker 启动命令需正确传入挂载与路径配置：
     ```bash
     -e HOST_DOWNLOAD_PATH=/Users/houtokki/Downloads/fast_sr \
     -e EXTERNAL_LIBRARY_PATHS="/Users/houtokki/Music/网易云音乐" \
     -v /Users/houtokki/Downloads/fast_sr:/media/music \
     -v "/Users/houtokki/Music/网易云音乐:/Users/houtokki/Music/网易云音乐:ro"
     ```
