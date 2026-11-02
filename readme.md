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

## 📱 iOS 快捷指令自动唤醒独立 PWA (iOS Shortcuts & Standalone PWA)

利用 iOS 快捷指令（Shortcuts）自动化与私有 `webapp://` 协议，可在 **连接蓝牙耳机 (AirPods) 或车载蓝牙时，自动全屏唤醒独立 PWA 播放器**（无 Safari 地址栏/底部栏，原生 App 级沉浸体验）。

> [!TIP]
> **为什么不直接选「打开 App」？**
> iOS 快捷指令的 App 选择列表不包含桌面 PWA WebClip；而使用「打开 URL」填入普通 `http(s)://` 会强制打开 Safari 普通标签页带白边与地址栏。
> **只需在快捷指令「打开 URL」中输入 `webapp://你的域名或IP:端口`**，系统即会直接以**独立全屏模式**呼起已添加到主屏幕的 PWA！

<details open>
<summary><b>🇨🇳 快速配置 (简体中文)</b></summary>

1. **添加至主屏幕**：在 iPhone Safari 打开播放器网站 -> 点击底部「分享」->「添加到主屏幕」；
2. **创建自动化**：打开系统「快捷指令」App ->「自动化」->「+」-> 触发条件选择「蓝牙」（例如 AirPods 或车载蓝牙）-> 勾选「立即运行」并关闭「运行前询问」；
3. **添加动作**：搜索并添加「打开 URL」，填入 `webapp://` + 域名或内网 IP（**切勿带 `http://` 或 `https://`**，例如 `webapp://music.yourdomain.com` 或 `webapp://192.168.1.100:8080`）；
4. 详细图文与进阶玩法请参阅完整文档：[📱 iOS 快捷指令独立 PWA 指南](docs/ios-shortcuts-pwa.md)。
</details>

<details>
<summary><b>🇺🇸 Quick Setup (English)</b></summary>

1. **Add to Home Screen**: Open the web app in Safari on iPhone -> tap "Share" -> "Add to Home Screen".
2. **Create Automation**: Open Apple "Shortcuts" -> "Automation" -> "+" -> Trigger: "Bluetooth" (e.g. AirPods or Car Bluetooth) -> Select "Run Immediately" & disable "Notify When Run".
3. **Add Action**: Add "Open URL" and enter `webapp://` + your domain or IP (e.g. `webapp://music.yourdomain.com`, **omit `http://` / `https://`**).
4. For detailed guides and troubleshooting, see: [📱 Full iOS Shortcuts PWA Guide](docs/ios-shortcuts-pwa.md).
</details>

<details>
<summary><b>🇯🇵 クイック設定 (日本語)</b></summary>

1. **ホーム画面に追加**: iPhoneのSafariでプレイヤーを開き、下部「共有」→「ホーム画面に追加」をタップ。
2. **オートメーション作成**: 「ショートカット」アプリ→「オートメーション」→「+」→「Bluetooth」（AirPodsやカーナビ等）を選択→「すぐに実行」に設定。
3. **アクション追加**: 「URLを開く」アクションを追加し、`webapp://` + ドメインまたはIPを入力（例: `webapp://music.yourdomain.com`、**`http://` や `https://` は不要**）。
4. 詳細ガイドはこちら: [📱 iOS ショートカット PWA ガイド](docs/ios-shortcuts-pwa.md)。
</details>

<details>
<summary><b>🇰🇷 빠른 설정 (한국어)</b></summary>

1. **홈 화면에 추가**: iPhone Safari에서 접속 -> 하단 '공유' -> '홈 화면에 추가' 선택.
2. **자동화 생성**: '단축어' 앱 -> '자동화' -> '+' -> 트리거로 'Bluetooth'(AirPods 또는 차량 블루투스) 선택 -> '확인하지 않고 실행' 체크.
3. **동작 추가**: 'URL 열기' 동작 추가 후 `webapp://` + 도메인/IP 입력 (예: `webapp://music.yourdomain.com`, **`http://` 및 `https://` 제외**).
4. 전체 가이드 및 FAQ: [📱 iOS 단축어 PWA 가이드](docs/ios-shortcuts-pwa.md).
</details>

<details>
<summary><b>🇹🇼 快速設定 (繁體中文)</b></summary>

1. **加入主畫面**：在 iPhone Safari 開啟網頁 -> 點擊下方「分享」->「加入主畫面」；
2. **建立自動化**：開啟「捷徑」App ->「自動化」->「+」-> 觸發條件選擇「藍牙」（如 AirPods 或車用藍牙）-> 勾選「立即執行」並關閉「執行前先詢問」；
3. **加入動作**：新增「打開 URL」動作，填入 `webapp://` + 網域名稱或 IP（**請勿包含 `http://` 或 `https://`**，例如 `webapp://music.yourdomain.com`）；
4. 完整詳細手冊請參閱：[📱 iOS 捷徑獨立 PWA 指南](docs/ios-shortcuts-pwa.md)。
</details>

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

## ☁️ 云端部署 (可选)

本项目默认支持本地 Docker / 离线运行。如果你希望以全托管、0 运维、按需计费的 Serverless 模式运行，我们提供了开箱即用的 AWS 部署模块：

- **技术栈**：AWS Lambda (SnapStart 毫秒级冷启动) + S3 音频存储 + CloudFront CDN + RDS PostgreSQL。
- **IaC 工具**：Terraform 模块化编排。
- **操作指南**：完整步骤请参阅 [AWS Lambda SnapStart 部署手册](./DEPLOY_AWS_SNAPSTART.md) 或 [terraform/README.md](./terraform/README.md)。

---

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。仅供个人学习、离线音乐备份与交流使用，请支持正版音乐。

