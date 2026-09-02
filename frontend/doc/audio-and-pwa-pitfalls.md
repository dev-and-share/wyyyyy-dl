# 音频播放、MediaSession 与 PWA 关键避坑指南

本文档记录在 Svelte 5 迁移及 PWA / iOS 适配过程中踩过的高频深坑、底层根因与防御解法。

---

## 1. 踩坑记录汇总

| 序号 | 故障现象 | 触发场景 | 底层根因 | 最终解法 |
| :--- | :--- | :--- | :--- | :--- |
| **01** | 切歌时只有歌名变，音频仍在播旧歌 | 点击下一首/上一首 | Svelte 5 `$derived(activeTrack)` 属于**惰性求值**，在同步函数内修改 `qIndex` 后立即调用 `ensurePlay()` 时，`activeTrack` 尚未重算，读取到了旧 track。 | 在 `ensurePlay` 中直接读取 `queue[qIndex]` 实时数组项，绕过 `$derived` 滞后。 |
| **02** | 锁屏/动态岛显示 `«10 10»` 跳秒键，而非 `⏮ ⏭` | iPhone 熄屏或控制中心 | 调用了 `mediaSession.setPositionState({ duration, ... })`，iOS 系统会强行将其判定为“播客/快进流媒体”，覆盖上一首/下一首按键。 | 对 iOS 设备跳过 `setPositionState`；显式将 `seekbackward` / `seekforward` handler 设为 `null`。 |
| **03** | 锁屏切歌或连播自动下一首“看似切了但没声音” | 切歌 / `onended` 自然播完 | iOS Safari 对 `audio.play()` 有严格的**手势信任链（User Gesture Context）**约束。如果在 `play()` 前执行了 `await resolveTrackUrl()` 异步等待，手势上下文即刻丢失，`play()` 被系统静默拒绝。 | 配合 `preloadNextTrack` 提前静默预解析；切歌与连播时**必须在任何 await 之前同步更新 src 并立即调用 `audio.play()`**。 |
| **04** | 歌单里的在线歌曲无法播放，被全部跳过 | 播放非本地下载歌曲 | `autoSkipTrial` 逻辑误将 `!track.isLocal` 判定为试听片段（把所有线上未下载歌曲全当成 VIP 试听跳过）。 | 纠正为严格判断 `track.freeTrial === true`。 |
| **05** | PWA 下拉刷新刷不出新版本，必须强退杀掉 App 重启 | 部署新版本后 | 1. `sw.js` 的 `CACHE_NAME` 未变更，浏览器 byte-to-byte 对比认为无需更新；<br>2. 新 SW 处于 waiting 状态，未调用 `skipWaiting` 和监听 `controllerchange` 自动重载。 | 1. `deploy.sh` 部署时自动同步升级 `package.json` 与 `sw.js` 缓存名；<br>2. 注册带 `{ updateViaCache: 'none' }`；<br>3. 前端监听 `controllerchange` 自动 `window.location.reload()`。 |
| **06** | 冷启动打开，点击播放从头开始且进度条/时间卡死在上次断点不动 | 关闭 PWA 重新打开后点播放 | 在用户未点击播放前，通过 `loadedmetadata` 强行给未缓冲完成的 `<audio>` 设置 `currentTime = seekTime`，触发了 **WebKit Seeking Deadlock（跳转死锁）**：系统底层从 0 秒发声，但媒体状态卡在 `seeking=true`，导致 W3C 规定的 `timeupdate` 事件被彻底锁死。 | 冷启动不预设 `currentTime`，改存 `pendingSeekTime`；等待用户点击 `play().then()` 音频流正常流动后，再延迟安全跳转断点。 |

---

## 2. 核心架构设计防御原则

1. **同步首播原则（iOS 保活生命线）**：
   用户交互事件（点击、MediaSession 动作、AirPods 双击）与 `audio.play()` 之间**严禁插入任何 `await` 异步网络调用**。所有 URL 嗅探与解析必须前置（Preload）完成。
2. **状态机与响应式分离原则**：
   在紧密时序控制（如切歌、切进度）中，优先使用底层确定性状态（如 `queue[qIndex]`、`audioEl.currentTime`），切勿过度依赖框架的异步惰性派生值。
3. **PWA 零残留热更原则**：
   Service Worker 必须具备主动接管（`SKIP_WAITING` + `clients.claim()`）和客户端感知能力（`controllerchange` -> 自动 reload）。
