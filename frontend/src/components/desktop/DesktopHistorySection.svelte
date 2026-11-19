<script lang="ts">
  import LocalSearchBox from '../LocalSearchBox.svelte';
  import SlotBtn from '../SlotBtn.svelte';
  import { RefreshCw, Trash2, Play, Pause } from '@lucide/svelte';
  import { t } from '../../lib/i18n';
  import { formatBytes, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { isSameTrack } from '../../lib/trackStatus.svelte';
  import type { Track } from '../../lib/types';

  let {
    curTrack = null,
    playing = false,
    histList = [],
    loadingHistory = false,
    histPage = 1,
    histTotalPages = 1,
    histTotal = 0,
    histKw = $bindable(''),
    onSearch,
    onPageChange,
    onDeleteHistory,
    onPlayQueue,
    onReveal
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    histList: any[];
    loadingHistory: boolean;
    histPage: number;
    histTotalPages: number;
    histTotal: number;
    histKw: string;
    onSearch: () => void;
    onPageChange: (p: number) => void;
    onDeleteHistory: (item: any) => void;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onReveal: (item: any) => void;
  }>();
</script>

<div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm flex flex-col">
  <!-- Search & Refresh Bar -->
  <div class="p-3 border-b border-[var(--border-color)] flex items-center justify-between gap-2.5">
    <div class="flex items-center gap-2 flex-1 max-w-md">
      <LocalSearchBox
        bind:value={histKw}
        placeholder={t('download.searchHistoryPlaceholder')}
        historyKey="wyy_history_search_history"
        onSearch={onSearch}
        onClear={onSearch}
      />
      <button
        type="button"
        class="btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
        onclick={onSearch}
      >
        {t('common.search')}
      </button>
    </div>
    <button
      type="button"
      class="p-2 rounded-xl text-xs bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--btn-secondary-border)] transition-colors cursor-pointer flex items-center justify-center"
      onclick={() => onPageChange(histPage)}
      title={t('download.refreshHistoryTooltip')}
    >
      <RefreshCw size={13} class={loadingHistory ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- History Table -->
  <div class="overflow-x-auto max-h-[560px] overflow-y-auto custom-scroll">
    <table class="w-full text-left border-collapse text-xs">
      <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
        <tr>
          <th class="w-12 py-3 pl-4 font-semibold">#</th>
          <th class="py-3 px-3 font-semibold">{t('search.tableTitle')}</th>
          <th class="py-3 px-3 font-semibold w-28">{t('download.sizeAndFormat')}</th>
          <th class="py-3 px-3 font-semibold hidden md:table-cell">{t('download.filePath')}</th>
          <th class="py-3 pr-4 text-right font-semibold w-40">{t('search.tableActions')}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[var(--border-subtle)]">
        {#if loadingHistory && histList.length === 0}
          <tr>
            <td colspan="5" class="py-12 text-center text-[var(--text-muted)]">
              {t('download.readingHistory')}
            </td>
          </tr>
        {:else if histList.length === 0}
          <tr>
            <td colspan="5" class="py-12 text-center text-[var(--text-muted)]">
              {t('download.noHistoryFound')}
            </td>
          </tr>
        {:else}
          {#each histList as item, i (item.id || i)}
            {@const idx = (histPage - 1) * 10 + i + 1}
            {@const songTitle = item.songName || item.name || item.title || t('common.unknownSong')}
            {@const artist = item.artist || item.artists || ''}
            {@const isPlayingThis = isSameTrack(curTrack, item)}
            {@const displayPath = item.hostFilePath || item.filePath || item.relativePath || item.path || t('download.defaultMusicDir')}
            <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
              <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                {#if isPlayingThis && playing}
                  <span class="text-red-500 animate-pulse">▶</span>
                {:else}
                  {idx}
                {/if}
              </td>
              <td class="py-2.5 px-3 min-w-0">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="font-semibold text-[var(--text-main)] truncate max-w-xs xl:max-w-md group-hover:text-red-400 transition-colors" title={songTitle}>
                      {songTitle}
                    </span>
                    {#if item.source && item.source !== 'netease'}
                      <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 shrink-0 select-none" title={`来源: ${item.source}`}>
                        {item.source.replace('musicfree-', '')}
                      </span>
                    {/if}
                  </div>
                  {#if artist}
                    <span class="text-[11px] text-[var(--text-muted)] truncate" title={artist}>{artist}</span>
                  {/if}
                </div>
              </td>
              <td class="py-2.5 px-3 text-[var(--text-secondary)] whitespace-nowrap">
                <span>{item.fileSize ? formatBytes(item.fileSize) : '-'}</span>
                {#if item.format}
                  <span class="ml-1 text-[10px] text-red-400/80 font-mono uppercase">.{item.format}</span>
                {/if}
              </td>
              <td class="py-2.5 px-3 text-[var(--text-muted)] font-mono text-[11px] truncate max-w-[240px] lg:max-w-[320px] xl:max-w-[420px] 2xl:max-w-[560px] hidden md:table-cell cursor-pointer hover:text-[var(--text-main)] transition-colors" title={`路径：${displayPath}\n（双击或点击复制）`} onclick={() => navigator.clipboard?.writeText(displayPath)}>
                {displayPath}
              </td>
              <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                <div class="inline-flex items-center justify-end gap-1.5">
                  <SlotBtn
                    playing={isPlayingThis && playing}
                    onclick={() => onPlayQueue([{
                      id: item.songId && item.songId > 0 ? item.songId : (item.id || `local_${Date.now()}`),
                      name: songTitle,
                      artist: artist || t('common.unknownArtist'),
                      album: item.album || t('download.localLibrary'),
                      cover: item.cover || DEFAULT_VINYL_COVER,
                      url: `/v3/stream?${item.songId && item.songId > 0 ? `id=${item.songId}&` : ''}${item.id ? `historyId=${item.id}&` : ''}path=${encodeURIComponent(item.relativePath || item.filePath || '')}`,
                      isLocal: true
                    }])}
                  >
                    {#if isPlayingThis && playing}
                      <Pause size={11} fill="currentColor" />
                      <span>{t('player.pause')}</span>
                    {:else}
                      <Play size={11} fill="currentColor" />
                      <span>{t('common.local')}</span>
                    {/if}
                  </SlotBtn>
                  <SlotBtn onclick={() => onReveal({ id: item.songId || item.id, name: songTitle, artist, path: displayPath })}>
                    {t('common.reveal')}
                  </SlotBtn>
                  <button
                    type="button"
                    class="p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 cursor-pointer border-none bg-transparent transition-colors flex items-center justify-center"
                    onclick={() => onDeleteHistory(item)}
                    title={t('download.removeFromHistoryTooltip')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Pagination Controls -->
  <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)] bg-[var(--card-bg)]">
    <button
      type="button"
      class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
      disabled={histPage <= 1}
      onclick={() => onPageChange(histPage - 1)}
    >
      {t('download.prevPage')}
    </button>
    <span class="text-xs text-[var(--text-secondary)]">
      {t('download.pageStats', { page: histPage, total: histTotalPages, count: histTotal })}
    </span>
    <button
      type="button"
      class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer"
      disabled={histPage >= histTotalPages}
      onclick={() => onPageChange(histPage + 1)}
    >
      {t('download.nextPage')}
    </button>
  </div>
</div>
