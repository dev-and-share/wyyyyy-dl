<script lang="ts">
  import { parseLrc, type LrcLine } from '../lib/lyricParser';
  import { api } from '../lib/api';

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

  let fetchedLyric = $state('');
  let rawLyricText = $derived(track?.lyric || fetchedLyric || '');
  let userSeekedAt = $state(0);
  const AUTO_SCROLL_PAUSE_MS = 3000;

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

  // 歌词自动居中平滑滚动（用户点击跳转后暂停 3s）
  $effect(() => {
    if (activeIdx >= 0) {
      const now = Date.now();
      if (now - userSeekedAt < AUTO_SCROLL_PAUSE_MS) return;
      const el = document.getElementById(`sv-lrc-${activeIdx}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // 若 track 缺少歌词，自动异步拉取
  async function loadTrackLyric(t: any) {
    if (!t || t.lyric) return;
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
</script>

<div class="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col justify-center">
  <div
    class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-8 flex flex-col gap-4 text-center scroll-smooth [mask-image:linear-gradient(to_bottom,transparent_0%,black_12%,black_93%,transparent_100%)] {skinId === 'cassette' || skinId === 'winamp' ? 'font-mono' : ''}"
    id="lyricModalContent"
  >
    {#if lrcs.length > 0}
      {#each lrcs as l, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          id="sv-lrc-{i}"
          class="cursor-pointer transition-all duration-300 break-words w-full px-2 {i === activeIdx
            ? (skinId === 'aurora'
                ? 'text-lg md:text-2xl font-bold text-[var(--skin-accent,#ef4444)] scale-105 drop-shadow-[0_0_16px_var(--skin-glow,rgba(239,68,68,0.5))]'
                : skinId === 'cassette'
                  ? 'text-lg md:text-xl font-bold text-[var(--skin-accent,#10b981)] scale-105 tracking-wide drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : skinId === 'winamp'
                    ? 'text-lg md:text-xl font-bold text-[#10b981] scale-105 tracking-widest drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                    : 'text-lg md:text-xl font-bold text-red-500 scale-105 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]')
            : (skinId === 'winamp'
                ? 'text-sm md:text-base text-emerald-500/50 hover:text-[#10b981]'
                : 'text-sm md:text-base text-[var(--text-muted)] hover:text-[var(--text-main)]')}"
          onclick={() => { userSeekedAt = Date.now(); onSeekTime(l.time); }}
        >
          {l.text}
        </div>
      {/each}
    {:else if rawLyricText}
      {#each rawLyricText.split(/\r?\n/) as lineStr}
        {#if lineStr.trim()}
          <p class="text-sm md:text-base text-[var(--text-muted)] my-1 leading-relaxed break-words px-2">{lineStr}</p>
        {/if}
      {/each}
    {:else}
      <div class="py-16 text-[var(--text-muted)] text-sm">暂无歌词</div>
    {/if}
  </div>
</div>
