# 音频播放、MediaSession 与 PWA 关键避坑指南

本文档深度记录在 Svelte 5 迁移及 PWA / iOS / macOS 适配过程中踩过的高频深坑、底层根因与终极防御解法。

---

## 1. 踩坑记录汇总

| 序号 | 故障现象 | 触发场景 | 底层根因 | 最终解法 |
| :--- | :--- | :--- | :--- | :--- |
| **01** | 切歌时只有歌名变，音频仍在播旧歌 | 点击下一首/上一首 | Svelte 5 `$derived(activeTrack)` 属于**惰性求值**，在同步函数内修改 `qIndex` 后立即调用 `ensurePlay()` 时，`activeTrack` 尚未重算，读取到了旧 track。 | 在 `ensurePlay` 中直接读取 `queue[qIndex]` 实时数组项，绕过 `$derived` 滞后。 |
| **02** | 锁屏/控制中心反复显示 `«15 15»` 跳秒键，而非 `⏮ ⏭` | iPhone 熄屏、灵动岛或 Mac 控制中心 | **苹果 WebKit 互斥裁决机制**：<br>1. 只要注册了 `seekto`（即使为了拖动进度条），系统一律判定为时间跳转型媒体；<br>2. 调用了 `setPositionState({ duration, ... })` 会上报时间戳，触发系统退回跳秒；<br>3. 默认快进快退未显式置空；<br>4. 误以为只有 `isIOS()` 受影响，Mac Safari 同样遵循该系统逻辑。 | 1. 显式将 `seekbackward`、`seekforward`、`seekto` 统统置为 `null`；<br>2. 全局彻底停用 `setPositionState`，不向系统上报时间跳转能力，绝对锁定 **⏮ 播放/暂停 ⏭** 布局。 |
| **03** | 锁屏切歌或连播自动下一首“看似切了但没声音” | 切歌 / `onended` 自然播完 | iOS Safari 对 `audio.play()` 有严格的**手势信任链（User Gesture Context）**约束。如果在 `play()` 前执行了 `await resolveTrackUrl()` 异步网络请求，数百毫秒后手势上下文彻底丢失，`play()` 被系统抛出 `NotAllowedError` 强行拒播。<br>尤其之前只有 `preloadNextTrack`，**完全缺少上一首预解析，导致锁屏点上一首必死**。 | 升级为 **双向并发预加载（`preloadSurroundingTracks`）**，当前曲目播放时并发就绪前后两首流地址；切歌时同步切换 `src` 并立即调用 `audio.play()`；无 URL 时先同步静默 `play()` 占住手势上下文。 |
| **04** | 歌单里的在线歌曲无法播放，被全部跳过 | 播放非本地下载歌曲 | `autoSkipTrial` 逻辑误将 `!track.isLocal` 判定为试听片段（把所有线上未下载歌曲全当成 VIP 试听跳过）。 | 纠正为严格判断 `track.freeTrial === true`。 |
| **05** | PWA 下拉刷新刷不出新版本，必须强退杀掉 App 重启 | 部署新版本后 | 1. `sw.js` 的 `CACHE_NAME` 未变更，浏览器 byte-to-byte 对比认为无需更新；<br>2. 新 SW 处于 waiting 状态，未调用 `skipWaiting` 和监听 `controllerchange` 自动重载。 | 1. `deploy.sh` 部署时自动同步升级 `package.json` 与 `sw.js` 缓存名；<br>2. 注册带 `{ updateViaCache: 'none' }`；<br>3. 前端监听 `controllerchange` 自动 `window.location.reload()`。 |
| **06** | 冷启动打开，点击播放从头开始且进度条/时间卡死在上次断点不动 | 关闭 PWA 重新打开后点播放 | 在用户未点击播放前，通过 `loadedmetadata` 强行给未缓冲完成的 `<audio>` 设置 `currentTime = seekTime`，触发了 **WebKit Seeking Deadlock（跳转死锁）**：系统底层从 0 秒发声，但媒体状态卡在 `seeking=true`，导致 W3C 规定的 `timeupdate` 事件被彻底锁死。 | 冷启动不预设 `currentTime`，改存 `pendingSeekTime`；等待用户点击 `play().then()` 音频流正常流动后，再延迟安全跳转断点。 |
| **07** | iPhone 熄屏瞬间，锁屏播放控件变灰（disabled）或几秒后卡片彻底消失 | 按电源键熄屏瞬间 | iPhone 熄屏时系统将网络切至后台节流模式，`<audio>` 在后台缓冲时极易触发 `waiting` 或 `stalled`。若监听了 `onwaiting/onstalled => playing = false`，会导致向 MediaSession 谎报 `paused`，系统判定已停止播放而禁用控件或销毁 Now Playing 会话。 | **彻底移除 `onwaiting` 与 `onstalled` 将 `playing` 置为 `false` 的错误逻辑**；在 `onplay` 时重新确认 `updateMediaSessionPlaybackState(true)`。 |
| **08** | iOS 熄屏后台播放数秒后音频静音中断 | 熄屏后台播放 | iOS 后台拉流使用 HTTP Range 206 分片机制，若 Service Worker 拦截该流请求，后台休眠会导致 fetch 挂起中断。 | 在 `sw.js` 中增加防御：检测到音频流且请求头含 `Range` 时，**直接 return 放行**，交由浏览器原生网络栈直连。 |
| **09** | 单文件代码膨胀触发 git commit 拦截失败 | 业务扩展新增面板 | 项目配置了 Husky pre-commit hook 单文件 <= 500 行限制（`scripts/check-file-lines.js`）。 | 保持组件高内聚与轻量化，及时抽离独立业务区域（例如将手机离线缓存从 `DownloadMgrTab` 剥离为独立的 `BrowserCacheSection.svelte`）。 |

---

## 2. 核心架构设计防御原则

### 原则 1：Now Playing 系统控件互斥法则（音乐原生优先）
在苹果生态（iOS / iPadOS / macOS）中，系统播控卡片在 **“曲目导航 (⏮ ⏭)”** 与 **“跳秒快进 (↺15 ↻15)”** 之间是绝对互斥的。
* **对于音乐播放器，必须彻底封死所有 Seeking 相关动作**：
  1. 显式设置 `seekbackward = null`、`seekforward = null`、`seekto = null`；
  2. 永久停用 `setPositionState` 上报；
  3. 牺牲系统级进度条拖动，换取坚不可摧的 **⏮ 播放/暂停 ⏭** 原生音乐体验。

### 原则 2：同步首播与双向预加载原则（iOS 保活生命线）
iOS Safari 的手势激活令牌（User Gesture Activation）在经过异步 `await` 后会迅速失效。
1. **双向周边预热**：在播放当前曲目时，必须通过 `preloadSurroundingTracks` 同步预解析下一首与上一首；
2. **零延迟同步切换**：切歌事件触发时，直接同步切换 `audioEl.src` 并同步调用 `audioEl.play()`；
3. **占位保活**：若遇无 URL 异常场景，必须在执行网络 await 之前先执行一次同步静默 `audioEl.play().catch(...)` 维持会话活跃。

### 原则 3：状态机与响应式分离原则
在紧密时序控制（如切歌、断点续播、锁屏硬件指令）中：
* 优先使用底层确定性状态（如实时读取 `queue[qIndex]`、`audioEl.currentTime`）；
* 坚决避免在同步调用栈中依赖框架的异步派生计算（如 Svelte 5 的 `$derived`）。

### 原则 4：PWA 零残留热更与原生网络直连
1. 每次生产部署**必须通过根目录 `./deploy.sh`**，确保版本号与 `sw.js` 缓存版本严格同步自增；
2. 带 Range 头的音频流请求一律绕过 Service Worker，直通后端 206 分片流服务，杜绝后台休眠中断。
