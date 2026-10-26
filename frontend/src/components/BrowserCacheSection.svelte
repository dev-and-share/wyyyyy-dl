<script lang="ts">
  import { onMount } from 'svelte';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import { formatBytes, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { autoCacheState, setAutoCacheEnabled } from '../lib/pwaCache.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { playerStore } from '../lib/playerStore.svelte';
  import { t } from '../lib/i18n';
  import {
    type BrowserCacheItem,
    scanBrowserCache,
    deleteBrowserCacheEntry,
    clearLowPlayCountCacheEntries,
    clearAllBrowserAudioCache,
    formatCacheDate,
    toBrowserTrack,
    filterCacheByMinPlayCount
  } from '../lib/browserCacheHelper';

  let {
    open = $bindable(true),
    flat = false,
    onPlayQueue,
    showToast = () => {}
  } = $props<{
    open?: boolean;
    flat?: boolean;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    showToast?: (msg: string, type?: 'info'|'success'|'warning'|'error', dur?: number) => void;
  }>();

  let accBrowserCache = $derived(open);
  let browserCacheList: BrowserCacheItem[] = $state([]);
  let browserCacheBytes = $state(0);
  let browserCacheLoading = $state(false);
  let minPlayThreshold = $state(2);
  let minPlayCountToPlay = $state(1);

  function handlePlayAll() {
    if (browserCacheList.length === 0) {
      showToast(t('cache.noOfflineCacheOnDevice'), 'info', 2000);
      return;
    }
    const queue = browserCacheList.map(toBrowserTrack);
    onPlayQueue(queue, 0);
    showToast(t('cache.startedPlayingAll', { count: queue.length }), 'success', 2000);
  }

  function handlePlayFiltered() {
    if (browserCacheList.length === 0) {
      showToast(t('cache.noOfflineCacheOnDevice'), 'info', 2000);
      return;
    }
    const threshold = Math.max(0, Number(minPlayCountToPlay) || 0);
    const filtered = filterCacheByMinPlayCount(browserCacheList, threshold);
    if (filtered.length === 0) {
      showToast(t('cache.noTracksAboveThreshold', { count: threshold }), 'info', 2000);
      return;
    }
    const queue = filtered.map(toBrowserTrack);
    onPlayQueue(queue, 0);
    showToast(t('cache.startedPlayingFiltered', { threshold, count: queue.length }), 'success', 2000);
  }

  async function loadList() {
    if (!('caches' in window)) {
      showToast(t('cache.notSupported'), 'warning');
      return;
    }
    browserCacheLoading = true;
    try {
      const res = await scanBrowserCache();
      browserCacheList = res.list;
      browserCacheBytes = res.totalBytes;
    } catch (e: any) {
      showToast(t('cache.scanFailed', { error: e.message || e }), 'error');
    } finally {
      browserCacheLoading = false;
    }
  }

  async function handleDeleteItem(item: BrowserCacheItem) {
    if (!confirm(t('cache.confirmDeleteSingle', { name: item.name }))) return;
    try {
      await deleteBrowserCacheEntry(item);
      await loadList();
      showToast(t('cache.deletedSingle'), 'success');
    } catch (e: any) {
      showToast(t('cache.deleteFailed', { error: e.message || e }), 'error');
    }
  }

  async function handleClearLowPlayCount() {
    const threshold = Math.max(1, Number(minPlayThreshold) || 2);
    const lowItems = browserCacheList.filter((item) => item.playCount < threshold);
    if (lowItems.length === 0) {
      showToast(t('cache.noTracksBelowThreshold', { threshold }), 'info', 2000);
      return;
    }
    const freedBytes = lowItems.reduce((acc, item) => acc + item.size, 0);
    const ok = confirm(t('cache.confirmBatchClean', { count: lowItems.length, threshold, size: formatBytes(freedBytes) }));
    if (!ok) return;

    browserCacheLoading = true;
    try {
      await clearLowPlayCountCacheEntries(lowItems);
      await loadList();
      showToast(t('cache.cleanedLowStats', { count: lowItems.length, size: formatBytes(freedBytes) }), 'success', 2500);
    } catch (e: any) {
      showToast(t('cache.cleanLowFailed', { error: e.message || e }), 'error');
    } finally {
      browserCacheLoading = false;
    }
  }

  async function handleClearAll() {
    if (!confirm(t('cache.confirmClearAll'))) return;
    try {
      await clearAllBrowserAudioCache();
      await loadList();
      showToast(t('cache.clearedAll'), 'success');
    } catch (e: any) {
      showToast(t('cache.clearFailed', { error: e.message || e }), 'error');
    }
  }

  function openTrackSheet(item: BrowserCacheItem) {
    const isPlayingThis = playerStore.playing && (
      String(playerStore.activeTrack?.id) === String(item.id) ||
      playerStore.activeTrack?.url === item.relUrl
    );

    const timeStr = item.time ? t('cache.cachedAtTime', { time: formatCacheDate(item.time) }) : '';
    openSheet({
      title: item.name,
      subtitle: t('cache.sheetSubtitle', {
        artist: item.artist,
        size: item.size ? formatBytes(item.size) : t('cache.offlineStorage'),
        playCount: item.playCount,
        time: timeStr
      }),
      actions: [
        {
          label: isPlayingThis ? '⏸ ' + t('player.pausePlay') : '▶️ ' + t('player.playNow'),
          style: 'primary',
          onclick: () => onPlayQueue([toBrowserTrack(item)])
        },
        {
          label: t('cache.deleteThisAction', { size: item.size ? formatBytes(item.size) : t('cache.releaseSpace') }),
          style: 'danger',
          onclick: () => handleDeleteItem(item)
        }
      ]
    });
  }

  let wasOpen = false;
  $effect(() => {
    if (accBrowserCache && !wasOpen) {
      loadList();
    }
    wasOpen = accBrowserCache;
  });

  onMount(() => {
    loadList();
    const reload = () => { loadList(); };
    window.addEventListener('wyyyy:browser-cache-updated', reload);
    window.addEventListener('wyyyy:song-play-updated', reload);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && accBrowserCache) loadList();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('wyyyy:browser-cache-updated', reload);
      window.removeEventListener('wyyyy:song-play-updated', reload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });
</script>

<AccordionCard title={t('cache.accordionTitle')} bind:open {flat} accent="emerald">
  <!-- Stats & Control Bar -->
  <div class="cache-stat-bar">
    <div class="stat-top-row">
      <div class="stat-info">
        <span>{t('cache.cachedCount', { count: browserCacheList.length })}</span>
        <span class="stat-divider">·</span>
        <span>{t('cache.sizeTotal', { size: browserCacheBytes ? formatBytes(browserCacheBytes) : '-' })}</span>
      </div>

      <div class="stat-top-actions">
        <button
          type="button"
          class="btn-secondary cache-action-btn"
          onclick={loadList}
          disabled={browserCacheLoading}
          title={t('cache.rescanTooltip')}
        >
          {browserCacheLoading ? t('cache.scanning') : '🔄 ' + t('common.refresh')}
        </button>

        <!-- Auto Cache Checkbox -->
        <label class="auto-cache-toggle" title={t('cache.autoCacheTooltip')}>
          <input
            type="checkbox"
            checked={autoCacheState.enabled}
            onchange={(e) => {
              const val = (e.currentTarget as HTMLInputElement).checked;
              setAutoCacheEnabled(val);
              showToast(val ? t('cache.autoCacheEnabled') : t('cache.autoCacheDisabled'), 'info', 1500);
            }}
          />
          <span class="font-medium text-[var(--text-main)]">{t('cache.autoCacheTitle')}</span>
        </label>
      </div>
    </div>

    <div class="stat-actions-row">
      <button
        type="button"
        data-testid="btn-cache-play-all"
        class="btn-primary cache-action-btn play-all-btn"
        onclick={handlePlayAll}
        disabled={browserCacheLoading || browserCacheList.length === 0}
        title={t('cache.playAllTooltip')}
      >
        {t('playlist.playAll')}
      </button>

      <div class="play-filter-control" title={t('cache.playFilterTooltip')}>
        <button
          type="button"
          data-testid="btn-cache-play-filtered"
          class="play-filter-btn"
          onclick={handlePlayFiltered}
          disabled={browserCacheLoading || browserCacheList.length === 0}
        >
          {t('cache.playAbove')}
        </button>
        <input
          type="number"
          min="0"
          max="99"
          data-testid="input-cache-play-min"
          class="clean-n-input"
          bind:value={minPlayCountToPlay}
          onclick={(e) => e.stopPropagation()}
          title={t('cache.minPlayCountTooltip')}
        />
        <span class="clean-unit-text">{t('cache.unitTimes')}</span>
      </div>

      <!-- Clear cache less than N plays -->
      <div class="clean-low-control" title={t('cache.cleanLowTooltip')}>
        <button
          type="button"
          class="clean-low-btn"
          onclick={handleClearLowPlayCount}
          disabled={browserCacheLoading || browserCacheList.length === 0}
        >
          {t('cache.cleanBelow')}
        </button>
        <input
          type="number"
          min="1"
          max="99"
          class="clean-n-input"
          bind:value={minPlayThreshold}
          onclick={(e) => e.stopPropagation()}
          title={t('cache.cleanThresholdTooltip')}
        />
        <span class="clean-unit-text">{t('cache.unitTimes')}</span>
      </div>

      <button
        type="button"
        class="btn-secondary cache-action-btn btn-danger"
        onclick={handleClearAll}
        disabled={browserCacheLoading || browserCacheList.length === 0}
        title={t('cache.clearAllTooltip')}
      >
        🗑️ {t('common.clear')}
      </button>
    </div>
  </div>

  <!-- Sorting Hint -->
  <div class="cache-sort-hint-bar">
    <div class="hint-text-wrap">
      <span class="hint-icon">📌</span>
      <span class="hint-label">{t('cache.sortRule')}</span>
    </div>
    <span class="hint-badge">{t('cache.totalOfflineTracks', { count: browserCacheList.length })}</span>
  </div>

  <!-- Offline Cache Track List -->
  <ul class="data-list scrollable-list">
    {#each browserCacheList as item}
      {@const isPlayingThis = playerStore.playing && (String(playerStore.activeTrack?.id) === String(item.id) || playerStore.activeTrack?.url === item.relUrl)}
      <li class="track-item-card" class:is-active-playing={isPlayingThis}>
        <div class="track-title-row">
          <span class="font-bold truncate">{item.name}</span>
          <span class="text-xs text-[var(--text-secondary)] truncate"> - {item.artist}</span>
          <span class="audio-source-badge icon-only badge-browser ml-1 flex-shrink-0" title={t('cache.storedOnDeviceTooltip')}>📲</span>
          <span class="play-count-badge ml-1 flex-shrink-0" title={t('cache.playCountTooltip', { count: item.playCount })}>
            {t('cache.playCountLabel', { count: item.playCount })}
          </span>
        </div>

        <!-- PC Desktop Actions -->
        <div class="hidden md:inline-flex items-center gap-2 track-action-group">
          {#if item.time}
            <span class="text-xs text-[var(--text-muted)] font-mono cache-time-tag" title={t('cache.cacheTimeTooltip')}>
              {formatCacheDate(item.time)}
            </span>
          {/if}
          <span class="text-xs text-[var(--text-secondary)]">{item.size ? formatBytes(item.size) : t('cache.offlineStorage')}</span>
          <SlotBtn
            playing={isPlayingThis}
            onclick={() => onPlayQueue([toBrowserTrack(item)])}
          >
            {isPlayingThis ? '⏸ ' + t('player.playing') : '▶️ ' + t('player.play')}
          </SlotBtn>
          <SlotBtn onclick={() => handleDeleteItem(item)}>🗑️ {t('common.delete')}</SlotBtn>
        </div>

        <!-- SP Mobile Actions -->
        <div class="inline-flex md:hidden items-center gap-1.5 flex-shrink-0">
          <SlotBtn
            playing={isPlayingThis}
            onclick={() => onPlayQueue([toBrowserTrack(item)])}
          >
            {isPlayingThis ? '⏸' : '▶️ ' + t('player.play')}
          </SlotBtn>
          <button
            type="button"
            class="btn-more-actions"
            onclick={() => openTrackSheet(item)}
            title={t('common.moreActions')}
            aria-label={t('common.moreActions')}
          >
            ···
          </button>
        </div>
      </li>
    {:else}
      <li style="padding:20px; text-align:center; color:var(--text-muted);">{browserCacheLoading ? t('cache.scanningCache') : t('cache.noOfflineCacheOnDevice')}</li>
    {/each}
  </ul>
</AccordionCard>

<style>
  .cache-stat-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--stat-bar-bg);
    border: 1px solid var(--border-subtle);
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .stat-top-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .stat-info { display: inline-flex; align-items: center; gap: 6px; }
  .stat-divider { color: var(--text-muted); opacity: 0.6; }
  .stat-top-actions { display: inline-flex; align-items: center; gap: 6px; }
  .auto-cache-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: var(--btn-secondary-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
  }
  .stat-actions-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .cache-action-btn { padding: 4px 10px; font-size: 12px; }
  .play-all-btn { font-weight: 600; }
  .btn-danger { color: #f87171; }
  .btn-danger:hover { background: rgba(239, 68, 68, 0.15); }
  .play-filter-control, .clean-low-control {
    display: inline-flex;
    align-items: center;
    background: var(--btn-secondary-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    overflow: hidden;
  }
  .play-filter-btn, .clean-low-btn {
    background: transparent;
    border: none;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--text-main);
    cursor: pointer;
  }
  .clean-n-input {
    width: 38px;
    background: transparent;
    border: none;
    border-left: 1px solid var(--border-subtle);
    color: var(--text-main);
    font-size: 12px;
    padding: 4px 2px;
    text-align: center;
  }
  .clean-unit-text { font-size: 11px; color: var(--text-muted); padding-right: 6px; }
  .cache-sort-hint-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    margin-bottom: 6px;
    font-size: 11px;
    color: var(--text-secondary);
  }
  .hint-text-wrap { display: inline-flex; align-items: center; gap: 4px; }
  .hint-badge {
    background: var(--btn-secondary-bg, rgba(255, 255, 255, 0.06));
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-subtle);
  }
  .track-item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .track-title-row { display: flex; align-items: center; min-width: 0; flex: 1; }
  .play-count-badge {
    font-size: 10px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    padding: 1px 5px;
    border-radius: 4px;
  }
  .cache-time-tag { font-size: 10px; }
  .btn-more-actions {
    background: transparent;
    border: none;
    font-size: 16px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
  }
</style>
