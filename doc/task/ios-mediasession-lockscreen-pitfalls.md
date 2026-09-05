# 深度复盘：iOS / macOS 锁屏与控制中心“上一首/下一首”反复消失的终极根因与防御

> **本文档定位**：针对 iOS 锁屏、灵动岛、macOS 播控小组件及 AirPods 硬件切歌反复退化为“±15s 跳秒快进/快退”、“切歌停播”、“按钮置灰”的问题进行全链路根因剖析，彻底固化防御契约，杜绝后续重构再次反弹。

---

## 一、现象背后的本质：苹果 WebKit 的“两套互斥模式”

在 iOS (Safari / PWA / WebKit) 及 macOS 播控中心（Now Playing Widget）中，系统级控制卡片中央两侧的按键槽位**在系统底层是绝对互斥的二选一**：

```
                    ┌─────────────────────────┐
                    │    Now Playing Widget   │
                    │       [ 封面与歌名 ]     │
                    └─────────────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
   【曲目导航模式 (Music)】                   【跳秒快进模式 (Podcast)】
   ⏮   上一首                                  ↺15 快退 15 秒
   ⏯   播放 / 暂停                             ⏯   播放 / 暂停
   ⏭   下一首                                  ↻15 快进 15 秒
```

### 苹果系统的仲裁法则：
**“只要网页暴露了任何时间进度跳转（Seeking）的意图，系统一律按 Podcast 处理，强制抹杀上一首/下一首，替换为 ±15s 快进快退。”**

---

## 二、为什么这个问题之前反反复复出现很多次？（6 大隐蔽陷阱全复盘）

回顾历次排查与修改，该问题之所以反反复复，是因为踩中了 **6 个环环相扣的暗坑**，每次“以为修复了”，实际上只堵住了其中一个口子：

### 陷阱 1：以为只要禁用 `seekbackward` 和 `seekforward` 就够了
* **误区**：第一次修复时，显式执行了：
  ```javascript
  navigator.mediaSession.setActionHandler('seekbackward', null);
  navigator.mediaSession.setActionHandler('seekforward', null);
  ```
* **真相**：即使这两个为 `null`，只要后续踩了陷阱 2 或陷阱 3，系统会瞬间重新激活默认的 ±15s 按钮！

### 陷阱 2：`setPositionState` 导致系统强行判定为“长音频时间轴”
* **误区**：在播放器的 `ontimeupdate` 或 `loadedmetadata` 中，频繁调用：
  ```javascript
  navigator.mediaSession.setPositionState({ duration, playbackRate, position });
  ```
* **真相**：一旦向苹果系统上报了 `duration` 和 `position`，WebKit 会向系统的 `MPNowPlayingInfoCenter` 注册高精度时间戳，系统判定该音频必须支持时间跳转，**直接将卡片重置为 ±15s 跳秒模式**！

### 陷阱 3：最隐蔽的刺客——`seekto` 监听器！
* **误区**：以为锁屏上可以保留进度条拖动（`handlers.onSeekTo`），只针对快进快退做了屏蔽：
  ```javascript
  if (handlers.onSeekTo) {
    navigator.mediaSession.setActionHandler('seekto', (details) => ...);
  }
  ```
* **真相**：**`seekto` 是直接映射到苹果底层的 `SeekToPlaybackPositionCommand` 的**！只要向 WebKit 声明了能够响应 `seekto`，苹果 Now Playing 组件就会立即认定该媒体是时间定位媒体，**自动激活左右两边的跳秒按钮（↺15 / ↻15）**。这是最容易被忽略但最致命的触发源！

### 陷阱 4：平台判断狭隘，误以为只有 `isIOS()` 受影响（Mac 上直接打脸）
* **误区**：代码写成了：
  ```javascript
  if (handlers.onSeekTo && !isIOS()) { ... } // ❌ 放过了 macOS！
  if (isIOS()) return; // setPositionState ❌ 放过了 macOS！
  ```
* **真相**：macOS Safari 的 WebKit 与 iOS Safari **共享完全相同的 `MPRemoteCommandCenter` 架构**。当在 Mac 上测试时，`isIOS()` 为 `false`，代码在 Mac 上如数注册了 `seekto` 并调用了 `setPositionState`，导致 Mac 菜单栏控制中心立刻显示 `↺15 ⏸ ↻15`！
* **解法**：音乐播放器在系统层面必须**全局一视同仁**彻底封死，绝不给系统任何退化为跳秒的借口。

### 陷阱 5：`onstalled` 与 `onwaiting` 误将 `playing` 置为 `false` 导致按钮置灰
* **误区**：在 `<audio>` 标签上监听网络缓冲：
  ```svelte
  onstalled={() => { playing = false; }}
  onwaiting={() => { playing = false; }}
  ```
* **真相**：当 iPhone 熄屏按电源键的瞬间，iOS 会立即将网络请求切换至后台节流模式，`<audio>` 极易在切歌或后台瞬间触发短暂的 `waiting`。上述代码将 `playing` 瞬间置为 `false`，MediaSession 上报了 `playbackState = 'paused'`。苹果锁屏认为播放已被暂停，**直接把切歌按钮变灰（disabled），数秒后直接撤掉整个锁屏播放小组件**！

### 陷阱 6：缺少“上一首”预加载，切上一首必因“手势断链”被拒播
* **误区**：只有单向的 `preloadNextTrack`，没有预解析上一首。
* **真相**：iOS 对熄屏/锁屏状态下的 `audio.play()` 有极其严苛的 **User Gesture Token（手势信任链）** 约束。
  * 用户在锁屏按“上一首”时，如果上一首没有预加载 URL，走入异步 `await resolveTrackUrl(track)` 网络请求；
  * **经过数百毫秒的异步 await 后，iOS 手势令牌彻底失效**；
  * 后续执行 `audio.play()` 时，WebKit 直接抛出 `NotAllowedError` 并静默拦截，导致切上一首歌时音乐立刻卡死停播。

---

## 三、最终彻底解决的“四大基石契约”（已固化）

### 1. 契约一：全平台绝对清除时间跳转（锁定⏮ ⏯ ⏭）
在 `frontend/src/lib/mediaSession.ts` 中：
```typescript
// 彻底清除并禁用所有时间快进/快退/时间跳转动作
try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch {}
try { navigator.mediaSession.setActionHandler('seekforward', null); } catch {}
try { navigator.mediaSession.setActionHandler('seekto', null); } catch {}
```

### 2. 契约二：全局永久停用 `setPositionState`
```typescript
export function updateMediaSessionPosition(_audioEl: HTMLAudioElement | null) {
  // 保持完全空实现：绝不上报 setPositionState，彻底剥夺系统展示跳秒按键的借口
  return;
}
```

### 3. 契约三：双向并发周边预加载（`preloadSurroundingTracks`）
在 `frontend/src/lib/playerHelper.ts` 中：
* 播放任意曲目时，同时并发预加载**下一首**与**上一首**的真实播放流 URL、高清封面与歌词；
* 锁屏点击上一首/下一首或 AirPods 切歌时，前后曲目内存中早有 URL，**直接同步切换 `audio.src` 并立即 `play()`**，0 延迟、0 await，100% 保持 iOS 手势上下文。

### 4. 契约四：移除缓冲误判暂停，强化 `onplay` 同步唤起
在 `frontend/src/components/GlobalAudioPlayer.svelte` 中：
* **删除 `onstalled` 与 `onwaiting` 的 `playing = false`**，杜绝锁屏卡片因网络等待而置灰；
* 在 `onplay` 时重新确认 `updateMediaSessionPlaybackState(true)` 与 `updateMediaSessionMetadata(activeTrack)`，确保锁屏系统通道时刻保持最高优先级活跃。

---

## 四、部署避坑红线

1. **绝对禁止**绕过脚本直接 `docker compose up -d --build`；
2. **必须使用根目录 `./deploy.sh`**：
   * 自动 bump 版本号；
   * 自动同步更新 `sw.js` 的 `CACHE_NAME`（否则客户端 Safari/PWA 处于强缓存，代码即使修复了手机端也永远跑旧版）；
   * 打 Tag 并触发多阶段 Docker 镜像重编。
