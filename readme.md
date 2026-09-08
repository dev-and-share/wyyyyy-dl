# 🎵 wyyyyy-dl (网易云音乐全能下载器 & 离线 Web Player)

<p align="center">
  <img src="src/main/resources/static/favicon.png" width="96" height="96" alt="wyyyyy-dl Logo" />
</p>

<p align="center">
  <b>极速解析 · 无损下载 · 智能比对 · SWR 秒开 · PWA 离线黑胶播放器 · 现代化全栈架构</b>
</p>

<p align="center">
  <a href="https://github.com/dev-and-share/wyyyyy-dl/releases"><img src="https://img.shields.io/github/v/release/dev-and-share/wyyyyy-dl?color=blue&label=Release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/Spring%20Boot-3.2.5-brightgreen.svg" alt="Spring Boot 3" />
  <img src="https://img.shields.io/badge/Java-21-orange.svg" alt="Java 21" />
  <img src="https://img.shields.io/badge/Svelte-5-ff3e00.svg" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8.svg" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Docker-Multi--Arch-2496ED.svg" alt="Docker Multi-Arch" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## 🌟 核心特性

- 🖥️ **现代化多端自适应界面**：全面采用 **Svelte 5 + Tailwind CSS v4**。PC 端提供专业侧边栏与宽屏分栏布局，移动端自然适配 PWA 随身听。
- ⚡ **无损解析与高速下载**：支持单曲、歌单（突破官方 1000 首限制）、专辑批量解析；智能比对本地已有音轨，杜绝重复下载。
- 📴 **PWA & Cache API 离线随身听**：支持将单曲/歌单直接离线保存在浏览器本地，断网或飞行模式下 0 延迟秒播。
- 📁 **本地曲库树与文件夹连播**：支持文件夹递归浏览、一键创建临时歌单连播、`.musicignore` 忽略管理以及外置硬盘/NAS 曲库只读挂载。
- 💿 **沉浸式黑胶播放器**：逐字同步歌词、系统级 MediaSession 锁屏控制（支持上一曲/下一曲/封面显示）。
- 🚀 **标准规范 /v3/ RESTful API**：全栈接口统一收口，模块清晰高内聚。

---

## 🚀 快速上手 (两种方式任选)

### 方式 1：Docker 部署 (推荐，免配环境)

```bash
docker run -d \
  --name=wyyyyy-dl \
  -p 8080:8080 \
  -v /your/music/path:/media/music \
  -e HOST_DOWNLOAD_PATH="/your/music/path" \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  ghcr.io/dev-and-share/wyyyyy-dl:latest
```

或使用 **Docker Compose**（创建 `docker-compose.yml`）：

```yaml
services:
  wyyyyy-dl:
    image: ghcr.io/dev-and-share/wyyyyy-dl:latest
    container_name: wyyyyy-dl
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - TZ=Asia/Shanghai
      - HOST_DOWNLOAD_PATH=/your/music/path
    volumes:
      - /your/music/path:/media/music
```

启动命令：
```bash
docker compose up -d
```

启动后在浏览器打开：`http://localhost:8080` 即可开始使用！

---

### 方式 2：直接下载可执行 JAR (需本地安装 Java 21)

1. 前往 [Releases 页面](https://github.com/dev-and-share/wyyyyy-dl/releases) 下载最新版的 `wyyyyy-dl-*.jar`；
2. 一键启动：
   ```bash
   java -jar wyyyyy-dl-5.0.0.jar --download.path=/your/music/path
   ```
3. 打开浏览器访问 `http://localhost:8080`。

---

## 🛠️ 本地开发与贡献

### 环境要求
- **JDK**: 21+
- **Node.js**: 20+

### 本地启动
```bash
# 1. 克隆项目
git clone https://github.com/dev-and-share/wyyyyy-dl.git
cd wyyyyy-dl

# 2. 启动前端开发服务器 (支持热重载，自动代理后端接口)
cd frontend
npm install
npm run dev

# 3. 启动后端服务 (另开一个终端窗口)
./gradlew bootRun
```

### 全栈构建与打包
```bash
# 运行前端测试与构建
cd frontend && npm run check && npm run test && npm run build

# 运行后端单元测试与独立 Jar 打包
./gradlew clean test bootJar
```

---

## 📂 工程架构

```
wyyyyy-dl/
├── frontend/               # Svelte 5 + Vite + Tailwind v4 现代前端
│   ├── src/
│   │   ├── components/     # 播放器、歌单、桌面侧边栏等 UI 组件 (<500行)
│   │   └── lib/            # Runes 状态管理、PWA Cache、API 客户端
│   └── tests/              # Vitest 单元测试 & Playwright E2E 测试
├── src/main/java/com/wyyyyydl/ # Spring Boot 3 后端源码
│   ├── config/             # 全局异常处理与过滤器
│   ├── controller/         # /v3/ RESTful API 控制器层
│   ├── service/            # 网易云解析与多线程下载调度服务
│   ├── dao/                # SQLite 本地音轨索引与历史持久化
│   └── utils/              # 音频流 Range 分片传输、ID3 标签读写
└── Dockerfile              # 多阶段容器化构建 (Node.js 22 + JDK 21)
```

---

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。仅供个人学习、离线音乐备份与交流使用，请支持正版音乐。
