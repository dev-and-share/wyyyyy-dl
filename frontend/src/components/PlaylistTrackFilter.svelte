<script lang="ts">
  import {
    allTracks,
    getFilteredTracks,
    getPlaylistSearchKeyword,
    setPlaylistSearchKeyword
  } from '../lib/playlist.svelte';
  import LocalSearchBox from './LocalSearchBox.svelte';
  import { t } from '../lib/i18n/index.svelte';

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
      placeholder={t('playlist.filterTracksPlaceholder')}
      clearTitle={t('playlist.clearFilter')}
      onInput={handleInput}
      onClear={() => setPlaylistSearchKeyword('')}
      inputClassName="!py-1.5"
    />
  </div>
  {#if keyword}
    <span class="text-xs text-[var(--text-muted)] shrink-0 whitespace-nowrap">
      {t('playlist.matchCount', { count: filtered.length, total: allTracks.length })}
    </span>
  {/if}
</div>
