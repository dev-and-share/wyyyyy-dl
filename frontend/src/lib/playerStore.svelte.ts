import type { Track } from './types';
import { getTrackSourceStatus } from './trackStatus.svelte';
import { savePlayerStateToStorage, loadPlayerStateFromStorage } from './playerStorage';

export type PlayMode = 'list' | 'single' | 'shuffle';

/**
 * 🎵 Fisher-Yates 原地数组洗牌算法
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * 💽 Svelte 5 Runes 全局单体播放器状态机
 * 践行 WYSIWYG（所见即所得）架构：
 * 1. 点击随机即洗牌重排列表，当前曲目置顶（第 0 项），列表一目了然；
 * 2. 之后的切歌永远按列表真实顺序执行，AirPods 三击严格回退上一首；
 * 3. 预加载目标与切歌状态机严格对齐，100% 确定命中。
 */
export class PlayerStore {
  queue = $state<Track[]>([]);
  qIndex = $state<number>(0);
  playMode = $state<PlayMode>('list');
  curTime = $state<number>(0);
  duration = $state<number>(0);
  playing = $state<boolean>(false);
  vol = $state<number>(0.85);
  autoSkipTrial = $state<boolean>(true);
  serverOnly = $state<boolean>(false);
  offlineOnly = $state<boolean>(false);

  // 派生：当前正在播放的曲目
  activeTrack = $derived.by<Track | null>(() => {
    if (this.queue.length === 0) return null;
    return this.queue[this.qIndex] || null;
  });

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const savedVol = Number(localStorage.getItem('wyyyy_player_vol'));
      if (!isNaN(savedVol) && savedVol > 0 && savedVol <= 1) {
        this.vol = savedVol;
      }
    }
  }

  /**
   * 校验曲目是否满足当前模式要求（服务器/离线/试听策略）
   */
  isValidTrack(track: Track | null | undefined): boolean {
    if (!track) return false;
    const status = getTrackSourceStatus(track.id, track.isLocal);
    if (this.offlineOnly && !status.isPhone) return false;
    if (this.serverOnly && !status.isServer) return false;
    if (this.autoSkipTrial && track.freeTrial === true) return false;
    return true;
  }

  /**
   * 🎲 WYSIWYG 洗牌算法：
   * 将当前正在播放的歌曲置于首位（index 0），其余曲目乱序重排，列表实时刷新呈现。
   * @returns 洗牌后的新队列
   */
  shuffleQueue(): Track[] {
    if (this.queue.length <= 1) return this.queue;

    const cur = this.queue[this.qIndex] || this.queue[0];
    const others = this.queue.filter((_, i) => i !== this.qIndex);
    const shuffledOthers = shuffleArray(others);

    this.queue = [cur, ...shuffledOthers];
    this.qIndex = 0;
    this.save();
    return this.queue;
  }

  /**
   * 获取确定性的下一首曲目索引
   */
  getNextTrackIndex(): number {
    if (this.queue.length === 0) return -1;
    if (this.playMode === 'single' && this.isValidTrack(this.queue[this.qIndex])) {
      return this.qIndex;
    }

    let attempts = 0;
    let nextIdx = this.qIndex;
    while (attempts < this.queue.length) {
      nextIdx = (nextIdx + 1) % this.queue.length;
      attempts++;
      if (this.isValidTrack(this.queue[nextIdx])) return nextIdx;
    }

    return -1;
  }

  /**
   * 获取确定性的上一首曲目索引（AirPods 三击 / 锁屏回退）
   */
  getPrevTrackIndex(): number {
    if (this.queue.length === 0) return -1;
    if (this.playMode === 'single' && this.isValidTrack(this.queue[this.qIndex])) {
      return this.qIndex;
    }

    let attempts = 0;
    let prevIdx = this.qIndex;
    while (attempts < this.queue.length) {
      prevIdx = (prevIdx - 1 + this.queue.length) % this.queue.length;
      attempts++;
      if (this.isValidTrack(this.queue[prevIdx])) return prevIdx;
    }

    return -1;
  }

  /**
   * 获取确定性的下一首 Track 对象（供预加载与切歌无缝复用）
   */
  getNextTrack(): Track | null {
    const idx = this.getNextTrackIndex();
    return idx >= 0 ? this.queue[idx] : null;
  }

  /**
   * 获取确定性的上一首 Track 对象
   */
  getPrevTrack(): Track | null {
    const idx = this.getPrevTrackIndex();
    return idx >= 0 ? this.queue[idx] : null;
  }

  /**
   * 指针前进至下一首
   */
  stepNext(): number {
    const nextIdx = this.getNextTrackIndex();
    if (nextIdx >= 0) {
      this.qIndex = nextIdx;
      this.curTime = 0;
      this.save();
    }
    return this.qIndex;
  }

  /**
   * 指针后退至上一首
   */
  stepPrev(): number {
    const prevIdx = this.getPrevTrackIndex();
    if (prevIdx >= 0) {
      this.qIndex = prevIdx;
      this.curTime = 0;
      this.save();
    }
    return this.qIndex;
  }

  /**
   * 切换播放/暂停状态
   */
  togglePlay(): boolean {
    this.playing = !this.playing;
    return this.playing;
  }

  /**
   * 切换播放模式 (list -> single -> shuffle[即时洗牌] -> list)
   */
  togglePlayMode(): PlayMode {
    if (this.playMode === 'list') {
      this.playMode = 'single';
    } else if (this.playMode === 'single') {
      this.playMode = 'shuffle';
      this.shuffleQueue();
    } else {
      this.playMode = 'list';
    }
    this.save();
    return this.playMode;
  }

  /**
   * 批量重设播放队列
   */
  setQueue(tracks: Track[], startIndex = 0) {
    if (!tracks || tracks.length === 0) return;
    this.queue = tracks;
    this.qIndex = startIndex >= 0 && startIndex < tracks.length ? startIndex : 0;
    this.curTime = 0;
    this.save();
  }

  /**
   * 从队列移除指定索引曲目
   */
  removeItem(realIndex: number) {
    if (realIndex < 0 || realIndex >= this.queue.length) return;
    this.queue = this.queue.filter((_, i) => i !== realIndex);
    if (this.qIndex >= this.queue.length) {
      this.qIndex = Math.max(0, this.queue.length - 1);
    }
    this.save();
  }

  /**
   * 清空整个播放队列
   */
  clearQueue() {
    this.queue = [];
    this.qIndex = 0;
    this.curTime = 0;
    this.duration = 0;
    this.playing = false;
    this.save();
  }

  /**
   * 切换仅播服务器过滤
   */
  toggleServerOnly(val: boolean) {
    this.serverOnly = val;
    if (val) this.offlineOnly = false;
    this.save();
  }

  /**
   * 切换纯离线模式过滤
   */
  toggleOfflineOnly(val: boolean) {
    this.offlineOnly = val;
    if (val) this.serverOnly = false;
    this.save();
  }

  /**
   * 切换跳过试听策略
   */
  toggleAutoSkipTrial(val: boolean) {
    this.autoSkipTrial = val;
    this.save();
  }

  /**
   * 状态持久化写入 LocalStorage
   */
  save() {
    savePlayerStateToStorage({
      queue: this.queue,
      qIndex: this.qIndex,
      playMode: this.playMode,
      curTime: this.curTime,
      autoSkipTrial: this.autoSkipTrial,
      serverOnly: this.serverOnly,
      offlineOnly: this.offlineOnly
    });
  }

  /**
   * 从 LocalStorage 恢复状态
   */
  restore() {
    const s = loadPlayerStateFromStorage();
    if (!s.queue?.length) return;
    this.queue = s.queue;
    this.qIndex = s.qIndex ?? 0;
    if (s.playMode) this.playMode = s.playMode;
    if (s.autoSkipTrial !== undefined) this.autoSkipTrial = s.autoSkipTrial;
    if (s.serverOnly !== undefined) this.serverOnly = s.serverOnly;
    if (s.offlineOnly !== undefined) this.offlineOnly = s.offlineOnly;
    if (s.curTime && s.curTime > 0) this.curTime = s.curTime;
  }
}

export const playerStore = new PlayerStore();
