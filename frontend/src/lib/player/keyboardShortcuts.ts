/**
 * ⌨️ 全局播放器空格快捷键处理器
 * 单按延迟 250ms 切换播放/暂停；280ms 内连按两次切换歌词沉浸大屏且不暂停音乐。
 */
export function createSpacebarShortcutHandler(callbacks: {
  hasActiveTrack: () => boolean;
  hasQueue: () => boolean;
  onTogglePlay: () => void;
  onToggleLyric: () => void;
  onStartQueueLyric: () => void;
}) {
  let spaceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDoublePressTime = 0;

  const handler = (e: KeyboardEvent) => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastDoublePressTime < 280) return;
    if (spaceTimer) {
      clearTimeout(spaceTimer);
      spaceTimer = null;
      lastDoublePressTime = now;
      if (callbacks.hasActiveTrack()) callbacks.onToggleLyric();
      else if (callbacks.hasQueue()) callbacks.onStartQueueLyric();
      return;
    }
    spaceTimer = setTimeout(() => {
      spaceTimer = null;
      callbacks.onTogglePlay();
    }, 250);
  };

  const cleanup = () => {
    if (spaceTimer) {
      clearTimeout(spaceTimer);
      spaceTimer = null;
    }
  };

  return { handler, cleanup };
}
