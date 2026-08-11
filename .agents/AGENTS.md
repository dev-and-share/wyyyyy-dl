# 🤖 AGENTS.md - 网易云音乐下载器 (netease-music-dl) 项目 Agent 避坑与行为准则

本文件整理了本项目在历次重构、数据库优化、播放器交互、移动端 SP 适配过程中沉淀的**硬核架构踩坑经验与代码准则**。后续所有 AI Agent 在修改、重构或扩充本项目代码时，**必须严格遵守以下规则**。

---

## 🗺️ 0. 项目整体架构速览

```
src/main/java/com/pewee/neteasemusic/
├── config/
│   ├── AnalysisConfig.java          # @ConfigurationProperties prefix=analysis (ip/port)
│   └── GlobalExceptionHandler.java  # 全局异常兜底
├── controller/
│   ├── QrLoginController.java       # 扫码登录入口 (GET / → qr_login.html / home.html)
│   ├── AnalysisController.java      # 核心解析 + 本地流拦截 (/Song_V1, /v2/stream, /Album, /Playlist, /Search, /MyPlaylist, /setCookie)
│   ├── MusicDownloadControllerV2.java # 下载调度 (/v2/single|playlist|album|tasks|setRepeat...)
│   └── DownloadHistoryController.java # 历史管理 (/v2/history/list|stats|scan|clean|importUntracked|scan_external|stream|raw|delete, /v2/reveal)
├── service/
│   ├── AnalysisService.java         # 调本地 NeteaseAPI (5000端口) 解析歌曲URL/专辑/歌单/搜索
│   ├── MusicDownloadService.java    # 实际下载逻辑 (异步线程池), 落盘后写 SQLite + saveRawJson
│   └── NeteaseAPIService.java       # HTTP 封装：获取 Cookie / QR key / 登录状态检查
├── dao/
│   └── DownloadHistoryDAO.java      # SQLite DAO（核心！）含全部文件扫描、比对、外部曲库索引
├── models/
│   ├── common/
│   │   ├── DownloadTaskStatus.java  # status: PENDING/DOWNLOADING/SUCCESS/SKIP/FAILED
│   │   └── RespEntity.java          # 统一响应体, code="000000" 表示成功
│   └── dtos/                        # 解析 API 返回 DTO
├── utils/
│   ├── TagUtils.java                # jaudiotagger 读写 ID3/FLAC 标签, readTags() 用于导入外部文件
│   ├── FileUtils.java               # 下载流落盘
│   ├── HttpClientUtil.java          # HTTP 工具
│   └── QrUtils.java                 # 二维码 Base64 生成
└── exceptions/                      # 业务异常体系

src/main/resources/
├── application.properties           # analysis.ip/port, download.path, host.download.path, external.library.paths
├── static/css/style.css             # 全局 UI 样式
├── static/js/
│   ├── app.js                       # 主入口：播放器全局状态 playAudioOnline()
│   ├── download-mgr.js              # 下载历史管理面板（UI + API 交互）
│   ├── search.js                    # 搜索功能
│   ├── playlist.js                  # 歌单解析 + 批量下载
│   └── album.js                     # 专辑解析 + 批量下载
└── templates/
    ├── home.html                    # 主功能页（Thymeleaf）
    └── qr_login.html                # 扫码登录页

src/test/java/com/pewee/neteasemusic/
├── controller/AnalysisControllerTest.java
├── controller/DownloadHistoryControllerTest.java
└── dao/DownloadHistoryDAOTest.java
```

**技术栈**：Spring Boot + Thymeleaf + SQLite (via JDBC) + jaudiotagger + FastJSON + Lombok + Gradle + Docker (adoptopenjdk/openjdk8)

**内置 NeteaseAPI**：应用启动后通过 `analysis.ip=127.0.0.1` + `analysis.port=5000` 调用本地 Python NeteaseAPI 服务进行歌曲解析。

---

## 🔑 1. 核心 API 接口速查表

| HTTP 方法 | 路径 | 说明 |
|-----------|------|------|
| GET/POST | `/setCookie` | 手动刷新 Cookie |
| GET/POST | `/Song_V1?id=&level=&name=&artist=` | 解析单曲（含本地流拦截） |
| GET | `/v2/stream?id=&historyId=` | 流式传输本地已下载音频 |
| GET/POST | `/Album?id=` | 解析专辑曲目列表 |
| GET/POST | `/Playlist?id=` | 解析歌单曲目列表 |
| GET/POST | `/Search?keywords=&limit=&offset=&type=` | 搜索（单曲1/专辑10/歌单1000） |
| GET/POST | `/MyPlaylist` | 获取当前登录用户歌单 |
| GET | `/v2/single?id=` | 异步下载单曲 |
| GET | `/v2/playlist?id=` | 批量异步下载歌单 |
| GET | `/v2/album?id=` | 批量异步下载专辑 |
| GET | `/v2/tasks` | 查询当前所有下载任务状态 |
| POST | `/v2/tasks/clear` | 清空任务队列 |
| GET | `/v2/setRepeat?repeat=` | 设置重复下载开关 |
| GET | `/v2/history/list?keyword=&page=&pageSize=` | 分页查询下载历史 |
| GET | `/v2/history/stats` | 统计（总数/总大小/缺失数） |
| GET | `/v2/history/stream?path=` | 流式播放本地历史音频 |
| GET | `/v2/history/raw?id=` | 读取原始 JSON 快照 |
| DELETE | `/v2/history/delete?id=` | 删除历史记录 |
| POST | `/v2/history/scan` | 扫描磁盘与数据库一致性 |
| POST | `/v2/history/cleanMissing` | 清理已丢失文件的记录 |
| POST | `/v2/history/importUntracked` | 一键导入未录入本地音频 |
| POST | `/v2/history/scan_external` | 扫描并索引外部曲库 |
| GET | `/v2/reveal?path=&taskId=` | 在 Finder/Explorer 中定位文件 |
| GET | `/qr/status?unikey=` | 轮询二维码扫码状态 |
| GET | `/login/status` | 查询当前登录状态 |

---

## 🗄️ 2. 数据库与 SQLite DAO 避坑准则 (`DownloadHistoryDAO.java`)

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
   - 外部曲库通过 `POST /v2/history/scan_external` 触发扫描与索引导入。

4. **`resolveFile()` / `toRelativePath()` 路径转换机制**：
   - DAO 内部维护容器路径（`/media/music/...`）与宿主机路径（`HOST_DOWNLOAD_PATH/...`）的双向转换；
   - 数据库中存储的是**相对路径**（或容器绝对路径），通过 `resolveFile()` 转为实际物理路径，**切勿直接拼接宿主机路径**。
   - `toHostPath(file)` 用于将容器路径换算为宿主机真实路径（`/v2/reveal` 接口返回给前端使用）。

5. **`importUntrackedFiles()` 导入逻辑**：
   - 通过 `TagUtils.readTags(file)` 读取 ID3/FLAC 标签，无标签时回退到文件名解析（`"歌手 - 歌名"` 格式）；
   - 未识别网易 ID 的记录，`song_id` 写入 `0`；
   - `quality` 字段写 `"local"`，`status` 字段写 `"SUCCESS"`。

6. **`download_history` 扩展子表 `download_history_raw`**：
   - 每次成功下载后，`MusicDownloadService` 会在 `addRecord()` 后调用 `saveRawJson(historyId, rawJson)` 存储 API 完整响应 JSON；
   - 通过 `GET /v2/history/raw?id=` 可查询，用于离线存档或调试。

---

## 📥 3. 下载任务生命周期 (`MusicDownloadService.java`)

- **任务状态机**（`DownloadTaskStatus.status`）：
  ```
  PENDING → DOWNLOADING → SUCCESS
                        → SKIP     (repeat=false 且已在 hs 集合中)
                        → FAILED
  ```
- `downloadTasks`（`ConcurrentHashMap<Long, DownloadTaskStatus>`）是全局内存任务表，重启丢失，**不持久化**。
- 下载目录结构：
  - 单曲：`{download.path}/歌名.flac`
  - 歌单：`{download.path}/歌单/{歌单名}/歌名.flac`
  - 专辑：`{download.path}/专辑/{专辑名}/歌名.flac`
- 下载完成后自动写 ID3/FLAC 标签（`TagUtils.setTags`）并保存歌词 `.lrc` 文件。

---

## 🎨 4. CSS 样式与 SP 移动端 UI 避坑准则 (`style.css` / `download-mgr.js`)

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

5. **`playAudioOnline()` 全局播放函数（`app.js`）**：
   - 是所有 JS 模块调用本地/在线音频播放的唯一入口；
   - 签名：`playAudioOnline(url, songName, artist, coverUrl, albumName)`；
   - 历史管理面板调用本地流时使用 `/v2/history/stream?path=encodedPath`；
   - 在线解析拦截后重定向至 `/v2/stream?id=...&historyId=...`。

---

## 🧪 5. 单元测试 (UT) 契约

1. **测试集合**：
   - 项目配有全量单元测试：
     - `DownloadHistoryDAOTest` (数据持久化、智能比对、多路径扫描测试)
     - `AnalysisControllerTest` (MockMvc 播放流拦截与搜索参数兼容测试)
     - `DownloadHistoryControllerTest` (分页与统计接口测试)
2. **测试运行要求**：
   - 每次修改核心 DAO 或 Controller 逻辑后，必须执行 `JAVA_HOME=... ./gradlew test`；
   - 保证全套测试 **100% BUILD SUCCESSFUL** 且无 Failures / Errors 后方可构建容器。

---

## 🐳 6. 构建、部署与环境规则

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

3. **构建流程**：
   - 打包：`JAVA_HOME=... ./gradlew clean build -x test`（生成 `build/libs/neteasemusic-1.0.0.jar`）
   - 镜像构建：`docker build -t peweelive/netease-music-dl:latest .`
   - 基础镜像：`adoptopenjdk/openjdk8:ubuntu-jre-nightly`（Java 8）

4. **应用端口**：默认 `8080`，内置 NeteaseAPI 服务在 `5000` 端口（`analysis.port`）。

5. **`application.properties` 关键配置项速查**：
   ```properties
   analysis.ip=127.0.0.1
   analysis.port=5000
   download.path=/media/music/
   host.download.path=${HOST_DOWNLOAD_PATH:}
   external.library.paths=${EXTERNAL_LIBRARY_PATHS:/media/external_music}
   ```

---

## ⚠️ 7. 新增功能必查清单

每次新增功能时，请对照以下清单逐项确认：

- [ ] SQL 查询中不出现 `status = 'COMPLETED'`（参见第 2 章）
- [ ] 新 Controller/DAO 方法修改后，同步更新并运行对应 UT
- [ ] 修改任何 `static/css/` 或 `static/js/` 文件后，递增 `home.html` 中资源 `?v=` 版本号
- [ ] 文件路径操作均通过 `resolveFile()` / `toRelativePath()`，不手动拼接路径
- [ ] 新的音频播放功能统一走 `playAudioOnline()` 入口（`app.js`）
- [ ] 移动端新增列表卡片时，遵守双排结构（`.card-title-row` + `.card-sub-row`）
- [ ] Docker 相关环境变量/挂载若有变化，同步更新 `.env.example` 与 `docker-compose.yml`
