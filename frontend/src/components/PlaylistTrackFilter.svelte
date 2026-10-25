<script lang="ts">
  import {
    allTracks,
    getFilteredTracks,
    getPlaylistSearchKeyword,
    setPlaylistSearchKeyword
  } from '../lib/playlist.svelte';
  import LocalSearchBox from './LocalSearchBox.svelte';

  let keyword = $state(getPlaylistSearchKeyword());
  let filtered = $derived(getFilteredTracks());

  $effect(() => {
    const current = getPlaylistSearchKeyword();
    if (current !== keyword) {
      keyword = current;
    }
  });

  function handleInput(val: string) {
    setPlaylistSearchKeyword(val);
  }
</script>

<div class="my-2.5 flex items-center gap-2">
  <div class="flex-1 min-w-0">
    <LocalSearchBox
      bind:value={keyword}
      placeholder="过滤歌曲、歌手 (支持拼音全拼与首字母)..."
      clearTitle="清除筛选"
      onInput={handleInput}
      onClear={() => setPlaylistSearchKeyword('')}
      inputClassName="!py-1.5"
    />
  </div>
  {#if keyword}
    <span class="text-xs text-[var(--text-muted)] shrink-0 whitespace-nowrap">
      匹配 <strong class="text-red-400">{filtered.length}</strong> / {allTracks.length} 首
    </span>
  {/if}
</div>
