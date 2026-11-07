<script lang="ts">
  import { onDestroy } from 'svelte';
  import { parseLrc, type LrcLine } from '../lib/lyricParser';
  import { api } from '../lib/api';
  import { t } from '../lib/i18n/index.svelte';

  let {
    track,
    currentTime,
    onSeekTime,
    skinId = 'vinyl'
  } = $props<{
    track: any;
    currentTime: number;
    onSeekTime: (time: number) => void;
    skinId?: string;
  }>();

  let containerEl = $state<HTMLDivElement | null>(null);
  let fetchedLyric = $state('');
  let rawLyricText = $derived(track?.lyric || fetchedLyric || '');

  // 🖱️ 鼠标拖动滚动 (Mouse Drag to Scroll) 与用户交互状态管理
  let isDragging = $state(false);
  let hasDragged = false;
  let dragStartY = 0;
  let dragStartScrollTop = 0;

  let isUserInteracting = $state(false);
  let resumeTimer: any = null;
  const RESUME_DELAY_MS = 3000; // 用户停止拖拽/滚动 3 秒后，平滑回弹聚焦回当前播放行

  function startResumeTimer() {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      isUserInteracting = false;
      scrollToActiveLine('smooth');
    }, RESUME_DELAY_MS);
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0 || !containerEl) return;
    isDragging = true;
    hasDragged = false;
    dragStartY = e.clientY;
    dragStartScrollTop = containerEl.scrollTop;
    isUserInteracting = true;
    clearTimeout(resumeTimer);

    const onWindowMouseMove = (me: MouseEvent) => {
      if (!isDragging || !containerEl) return;
      const deltaY = me.clientY - dragStartY;
      if (Math.abs(deltaY) > 4) {
        hasDragged = true;
      }
      containerEl.scrollTop = dragStartScrollTop - deltaY;
    };

    const onWindowMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        startResumeTimer();
      }
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  }

  function handleWheel() {
    isUserInteracting = true;
    startResumeTimer();
  }

  function handleTouchStart() {
    isUserInteracting = true;
    clearTimeout(resumeTimer);
  }

  function handleTouchEnd() {
    startResumeTimer();
  }

  let lrcs = $derived(parseLrc(rawLyricText));

  // 计算当前高亮行
  let activeIdx = $derived.by(() => {
    let idx = -1;
    for (let i = 0; i < lrcs.length; i++) {
      if (currentTime >= lrcs[i].time) idx = i;
      else break;
    }
    return idx;
  });

  // 🎯 仅针对歌词容器自身滚动，杜绝 scrollIntoView 向上波及父容器和黑胶舞台
  function scrollToActiveLine(behavior: ScrollBehavior = 'smooth') {
    if (!containerEl || activeIdx < 0 || isUserInteracting || isDragging) return;
    const lineEl = document.getElementById(`sv-lrc-${activeIdx}`);
    if (!lineEl) return;

    // lineEl 在 position:relative 的 containerEl 内的相对纵坐标
    const lineCenter = lineEl.offsetTop + lineEl.offsetHeight / 2;
    const containerHalf = containerEl.clientHeight / 2;
    const maxScrollTop = Math.max(0, containerEl.scrollHeight - containerEl.clientHeight);
    const targetTop = Math.max(0, Math.min(lineCenter - containerHalf, maxScrollTop));

    if (typeof containerEl.scrollTo === 'function') {
      containerEl.scrollTo({
        top: targetTop,
        behavior
      });
    } else {
      containerEl.scrollTop = targetTop;
    }
  }

  // 歌词自动居中平滑滚动（当用户未在翻看歌词时触发）
  $effect(() => {
    if (activeIdx >= 0 && !isUserInteracting && !isDragging) {
      scrollToActiveLine('smooth');
    }
  });

  // 真正切歌（track.id 变动）时重置手动滚动状态并回到初始位置
  let lastTrackId: any = null;
  $effect(() => {
    if (track?.id && track.id !== lastTrackId) {
      lastTrackId = track.id;
      isUserInteracting = false;
      isDragging = false;
      clearTimeout(resumeTimer);
      if (containerEl) {
        if (typeof containerEl.scrollTo === 'function') {
          containerEl.scrollTo({ top: 0, behavior: 'instant' });
        } else {
          containerEl.scrollTop = 0;
        }
      }
    }
  });

  // 点击歌词行立即跳转并居中（若为拖动结束则不误判为点击）
  function handleLineClick(line: LrcLine, index: number) {
    if (hasDragged) return;
    isUserInteracting = false;
    clearTimeout(resumeTimer);
    onSeekTime(line.time);
    if (!containerEl) return;
    const lineEl = document.getElementById(`sv-lrc-${index}`);
    if (lineEl) {
      const lineCenter = lineEl.offsetTop + lineEl.offsetHeight / 2;
      const containerHalf = containerEl.clientHeight / 2;
      const maxScrollTop = Math.max(0, containerEl.scrollHeight - containerEl.clientHeight);
      const targetTop = Math.max(0, Math.min(lineCenter - containerHalf, maxScrollTop));
      if (typeof containerEl.scrollTo === 'function') {
        containerEl.scrollTo({
          top: targetTop,
          behavior: 'smooth'
        });
      } else {
        containerEl.scrollTop = targetTop;
      }
    }
  }

  // 若 track 缺少歌词，自动异步拉取
  async function loadTrackLyric(t: any) {
    if (!t || t.lyric) return;
    const numId = Number(t.id);
    if (isNaN(numId) || numId <= 0 || String(t.id).startsWith('mf_')) return;
    try {
      const j = await api.songV1(String(t.id), 'lossless');
      if (j?.data?.lyric) {
        fetchedLyric = j.data.lyric;
        t.lyric = j.data.lyric;
      }
    } catch {}
  }

  $effect(() => {
    if (track) loadTrackLyric(track);
  });

  onDestroy(() => {
    clearTimeout(resumeTimer);
  });
</script>

<div class="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col justify-center select-none">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={containerEl}
    class="relative w-full h-full overflow-y-auto overflow-x-hidden px-4 flex flex-col gap-4 text-center scroll-smooth [mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_86%,transparent_100%)] {isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'} {skinId === 'cassette' || skinId === 'winamp' ? 'font-mono' : ''}"
    style="padding-top: 38vh; padding-bottom: 38vh;"
    id="lyricModalContent"
    onmousedown={handleMouseDown}
    onwheel={handleWheel}
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
  >
    {#if lrcs.length > 0}
      {#each lrcs as l, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          id="sv-lrc-{i}"
          class="transition-all duration-300 break-words w-full px-2 py-1 select-none {i === activeIdx
            ? (skinId === 'aurora'
                ? 'text-lg md:text-2xl font-bold text-[var(--skin-accent,#ef4444)] scale-105 drop-shadow-[0_0_16px_var(--skin-glow,rgba(239,68,68,0.5))]'
                : skinId === 'cassette'
                  ? 'text-lg md:text-xl font-bold text-[var(--skin-accent,#10b981)] scale-105 tracking-wide drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : skinId === 'winamp'
                    ? 'text-lg md:text-xl font-bold text-[#10b981] scale-105 tracking-widest drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                    : skinId === 'spring'
                      ? 'text-lg md:text-xl font-bold text-emerald-400 scale-105 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                      : skinId === 'sakura'
                        ? 'text-lg md:text-xl font-bold text-pink-300 scale-105 drop-shadow-[0_0_14px_rgba(255,64,129,0.7)]'
                        : skinId === 'summer'
                          ? 'text-lg md:text-xl font-bold text-sky-300 scale-105 drop-shadow-[0_0_14px_rgba(56,189,248,0.7)]'
                          : skinId === 'autumn'
                            ? 'text-lg md:text-xl font-bold text-yellow-300 scale-105 drop-shadow-[0_0_14px_rgba(250,204,21,0.7)]'
                            : skinId === 'winter'
                              ? 'text-lg md:text-xl font-bold text-white scale-105 drop-shadow-[0_0_14px_rgba(255,255,255,0.85)]'
                              : 'text-lg md:text-xl font-bold text-red-500 scale-105 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]')
            : (skinId === 'winamp'
                ? 'text-sm md:text-base text-emerald-400/50 hover:text-[#10b981]'
                : 'text-sm md:text-base text-white/45 hover:text-white/90')}"
          onclick={() => handleLineClick(l, i)}
        >
          {l.text}
        </div>
      {/each}
    {:else if rawLyricText}
      {#each rawLyricText.split(/\r?\n/) as lineStr}
        {#if lineStr.trim()}
          <p class="text-sm md:text-base text-white/50 my-1 leading-relaxed break-words px-2">{lineStr}</p>
        {/if}
      {/each}
    {:else}
      <div class="py-16 text-white/40 text-sm">{t('player.lyricEmpty')}</div>
    {/if}
  </div>
</div>
