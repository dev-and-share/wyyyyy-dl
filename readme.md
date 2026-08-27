# 🎵 网易云音乐全能下载器 & 离线 Web Player (PWA)

<p align="center">
  <img src="src/main/resources/static/favicon.png" width="100" height="100" alt="Logo" />
</p>

<p align="center">
  <b>极速解析 · 无损下载 · 智能比对 · SWR 秒开 · PWA 离线缓存 · 沉浸黑胶播放器</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Spring%20Boot-2.7.x-brightgreen.svg" alt="Spring Boot" />
  <img src="https://img.shields.io/badge/Java-8%2B-orange.svg" alt="Java" />
  <img src="https://img.shields.io/badge/PWA-Supported-blue.svg" alt="PWA" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED.svg" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## 🌟 核心亮点与特性

本项目是一个基于 **Spring Boot + Thymeleaf + SQLite + PWA** 打造的现代化网易云音乐解析下载与随身播放中心。不仅支持极速无损音质下载，更深度适配了移动端与桌面端的无缝播放与离线体验。

### 1. ⚡ SWR（Stale-While-Revalidate）零延迟秒开
- **Cache-First 渲染**：歌单、专辑、用户收藏列表打开时**0 毫秒优先加载本地缓存**，秒级呈现曲目与封面，告别转圈白屏。
- **静默后台刷新**：在毫秒展现的同时后台异步拉取最新数据，数据有变动时平滑热更新，无变动静默保持，体验丝滑流畅。

### 2. 📴 PWA & Cache API 全量离线随身听
- **手机/浏览器本地缓存**：支持将单曲、歌单、专辑一键批量缓存至移动端/电脑浏览器 Cache Storage 中。
- **永久存储保护**：接入 `navigator.storage.persist()` API，防止浏览器因存储清理策略误删音频缓存。
- **离线无网秒播**：断网或飞行模式下，PWA 应用离线正常打开并播放所有已缓存歌曲。

### 3. 🏷️ 三态音轨 Badge 体系
每首歌曲均配有直观的来源状态指示：
- 🖥️ **服务器本地（绿色）**：曲目已在 NAS / 服务器磁盘下载落盘。
- 📲 **浏览器缓存（蓝紫）**：曲目已离线缓存至当前设备浏览器。
- ✨ **双端就绪（金色）**：服务器与当前设备均已就绪，100% 0 延迟秒播。

### 4. 📜 交互式播放列表 (Draggable & Resizable)
- **自由拖拽与大小调整**：播放列表窗口支持按住顶栏自由拖拽移动至任意位置，右下角可随心缩放窗口尺寸。
- **分类过滤与实时搜索**：支持一键筛选 `全部` / `✨ 离线就绪` / `🖥️ 本地` / `📲 缓存`，并支持输入歌名/歌手快速过滤。
- **智能播放策略开关**：
  - 🛡️ **自动跳过试听**：切歌遇到 30 秒试听片段时，自动提示并直接切到下一首完整歌曲。
  - 📴 **纯离线模式**：仅在本地/已缓存曲目中流转播放，不耗费任何外网流量。
- **✂️ 一键裁剪队列**：激活筛选时，一键将当前筛选出的子集曲目直接设为新的播放队列。

### 5. 🚀 突破官方 1000 首超大歌单限制
- **自动全量补齐**：针对超出网易云官方 1000 首限制的超大歌单（如 1600+ 首），后端自动分页分批抓取全部剩余歌曲详情，实现 100% 完整解析与批量下载。
- **内存级极速索引**：毫秒级全量本地数据库智能模糊匹配，瞬间识别全歌单本地已下载状态。

### 6. 🗄️ SQLite 历史管理 & 多路径外部曲库挂载
- **智能跨专辑音轨比对**：点击任意在线精选辑或翻唱歌曲时，自动识别匹配本地已有无损文件，拦截线上试听片段，实现 0 延迟本地无损秒播。
- **外部曲库索引**：支持只读挂载主机已有的大容量音乐库（`EXTERNAL_LIBRARY_PATHS`），一键扫描并建立检索索引。
- **下载历史全生命周期**：支持按歌曲 ID/名称模糊搜索、缺失文件检测与清理、本地未录入音频一键导入、系统文件管理器定位（Reveal in Finder/Explorer）。

### 7. 🎤 沉浸式大黑胶播放器 & 硬件级 MediaSession
- **全屏黑胶唱片模式**：随音乐旋律平滑旋转的唱片封面与全屏大字歌词逐字同步滚动。
- **锁屏与耳机遥控**：深度接入原生 `MediaSession API`，支持 iOS / Android 锁屏界面显示封面、歌名、歌手与上一曲/下一曲/进度条拖拽控制。
- **iOS 锁屏保活切歌**：底层纯同步切歌架构，消除网络请求等待，防止系统后台休眠中断。

---

## 🖼️ 界面预览

| 桌面端主界面 | 移动端 PWA 与离线管理 | 沉浸式全屏黑胶播放器 |
| :---: | :---: | :---: |
| ![PC](https://raw.githubusercontent.com/dev-and-share/wyyyyy-dl/refs/heads/master/pics/2.JPG) | ![SP](https://raw.githubusercontent.com/dev-and-share/wyyyyy-dl/refs/heads/master/pics/1.JPG) | 🎵 逐字歌词 & 锁屏遥控 |

---

## 🐳 Docker 快速部署（推荐）

通过 Docker 即可实现开箱即用，支持将宿主机下载目录与已有音乐库直接挂载：

```bash
docker run -d \
  --name=netease-music-dl \
  -p 8080:8080 \
  -v /path/to/downloads:/media/music \
  -v "/path/to/external_music:/media/external_music:ro" \
  -e HOST_DOWNLOAD_PATH="/path/to/downloads" \
  -e EXTERNAL_LIBRARY_PATHS="/media/external_music" \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  peweelive/netease-music-dl:latest
```

启动后在浏览器打开 `http://<服务器IP>:8080/` 即可开始使用。

---

## 📦 docker-compose 部署

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  netease-music-dl:
    image: peweelive/netease-music-dl:latest
    container_name: netease-music-dl
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - TZ=Asia/Shanghai
      - HOST_DOWNLOAD_PATH=/your/host/download/path
      - EXTERNAL_LIBRARY_PATHS=/media/external_music
    volumes:
      - /your/host/download/path:/media/music
      - /your/host/external_music:/media/external_music:ro
```

运行：
```bash
docker-compose up -d
```

---

## 🛠️ 本地开发与构建

### 环境要求
- **Java**: OpenJDK 8 ~ 15
- **Gradle**: 7.x+ (项目自带 `./gradlew`)

### 构建步骤
```bash
# 1. 克隆代码库
git clone https://github.com/dev-and-share/wyyyyy-dl.git
cd wyyyyy-dl

# 2. 运行测试
./gradlew test

# 3. 编译打包 Jar
./gradlew clean build -x test

# 4. 运行服务
java -jar build/libs/neteasemusic-1.0.0.jar --download.path=/path/to/music/
```

---

## 📂 项目工程架构

```
src/main/java/com/pewee/neteasemusic/
├── config/                  # 配置加载与全局异常捕获
├── controller/              # 控制器层 (解析、流传输、下载调度、历史管理)
├── service/                 # 核心解析与下载业务逻辑
├── dao/                     # SQLite 数据访问层（本地音轨索引与智能匹配）
├── models/                  # 数据模型与传输 DTO
└── utils/                   # ID3/Flac 标签读写、文件流落盘、二维码生成

src/main/resources/
├── static/
│   ├── css/style.css        # 现代暗黑自适应样式
│   ├── js/                  # 模块化前端引擎 (app/playlist/album/search/download-mgr)
│   └── sw.js                # Service Worker 离线缓存与资源预载
└── templates/
    ├── home.html            # 主操作台 (Thymeleaf)
    └── qr_login.html        # 二维码扫码登录页
```

---

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。仅供个人学习与音乐存档交流使用，请支持正版音乐。
