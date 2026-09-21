<script lang="ts">
  import {
    allTracks,
    getFilteredTracks,
    getPlaylistSearchKeyword,
    setPlaylistSearchKeyword
  } from '../lib/playlist.svelte';

  let keyword = $derived(getPlaylistSearchKeyword());
  let filtered = $derived(getFilteredTracks());
</script>

<div class="my-2.5 flex items-center gap-2">
  <div class="relative flex-1">
    <input
      type="search"
      placeholder="过滤歌曲、歌手 (支持拼音与首字母)..."
      class="w-full text-xs py-1.5 pl-8 pr-7 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)] focus:border-red-500/60 focus:outline-none transition-all placeholder:text-[var(--text-muted)]"
      value={keyword}
      oninput={(e) => setPlaylistSearchKeyword((e.currentTarget as HTMLInputElement).value)}
    />
    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 pointer-events-none">🔍</span>
    {#if keyword}
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
        onclick={() => setPlaylistSearchKeyword('')}
        title="清除筛选"
      >
        ✕
      </button>
    {/if}
  </div>
  {#if keyword}
    <span class="text-xs text-[var(--text-muted)] shrink-0 whitespace-nowrap">
      匹配 <strong class="text-red-400">{filtered.length}</strong> / {allTracks.length} 首
    </span>
  {/if}
</div>
