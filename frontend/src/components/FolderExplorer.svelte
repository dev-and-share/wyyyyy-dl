<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { t } from '../lib/i18n';
  import FolderNode from './FolderNode.svelte';
  import LocalSearchBox from './LocalSearchBox.svelte';
  import { DEFAULT_VINYL_COVER, matchesKeyword } from '../lib/utils';

  let {
    onPlayQueue,
    onReveal,
    showToast
  } = $props<{
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onReveal?: (item: any) => void;
    showToast?: (m: string, t?: string) => void;
  }>();

  let roots: any[] = $state([]);
  let curRoot: any = $state(null);
  let tree: any[] = $state([]);
  let filterKw = $state('');
  let expandSignal = $state(0);

  async function loadRoots() {
    try {
      const j = await api.folderRoots();
      roots = j?.data || [];
      if (roots.length) {
        const def = roots.find((r: any) => r.name.includes('外部') || r.name.toLowerCase().includes('external')) || roots[0]; // i18n-ignore: default root search
        selectRoot(def);
      }
    } catch {}
  }

  async function selectRoot(r: any) {
    curRoot = r;
    tree = [];
    expandSignal = 0;
    await loadBrowse(r.path, true);
  }

  async function loadBrowse(path: string, isRoot = false) {
    try {
      const j = await api.folderBrowse(path);
      const items = j?.data || [];
      if (isRoot) tree = items;
    } catch {}
  }

  function playFolder(path: string, name: string) {
    api.folderTracks(path, true).then((j: any) => {
      const tracks = j?.data || [];
      if (!tracks.length) {
        if (showToast) showToast(t('folder.noPlayableFiles'), 'warning');
        else window.dispatchEvent(new CustomEvent('svelte:toast', { detail: { msg: t('folder.noPlayableFiles'), type: 'warning' } }));
        return;
      }
      const formatted = tracks.map((trackItem: any, idx: number) => {
        const playPath = trackItem.relativePath || trackItem.filePath || trackItem.path;
        return {
          id: trackItem.songId && trackItem.songId > 0 ? trackItem.songId : (trackItem.id && trackItem.id > 0 ? trackItem.id : `local_${Date.now()}_${idx}`),
          name: trackItem.songName || trackItem.name || t('common.unknownSong'),
          artist: trackItem.artist || t('common.unknownArtist'),
          album: trackItem.album || name,
          cover: DEFAULT_VINYL_COVER,
          url: `/v3/stream?path=${encodeURIComponent(playPath)}`,
          isLocal: true
        };
      });
      if (onPlayQueue) {
        onPlayQueue(formatted, 0);
        showToast?.(t('folder.playingFolderStats', { name, count: formatted.length }), 'success');
      } else {
        window.dispatchEvent(new CustomEvent('svelte:playFolder', { detail: { tracks, name } }));
      }
    });
  }

  function playSingle(item: any) {
    const playPath = item.relativePath || item.filePath || item.path;
    const track = {
      id: item.songId && item.songId > 0 ? item.songId : (item.id || `local_${Date.now()}`),
      name: item.songName || item.name || t('common.unknownSong'),
      artist: item.artist || t('common.unknownArtist'),
      album: item.album || t('download.localLibrary'),
      cover: DEFAULT_VINYL_COVER,
      url: item.streamUrl || `/v3/stream?path=${encodeURIComponent(playPath)}`,
      isLocal: true
    };
    if (onPlayQueue) {
      onPlayQueue([track], 0);
      showToast?.(t('player.playingWithName', { name: track.name }), 'info');
    } else {
      window.dispatchEvent(new CustomEvent('svelte:playFolder', { detail: { tracks: [track], name: track.name } }));
    }
  }

  function revealItem(item: any) {
    if (onReveal) {
      onReveal(item);
    } else if (item.hostPath) {
      alert(item.hostPath);
    }
  }

  onMount(loadRoots);
</script>

<div>
  <!-- 根目录选择与全局搜索整合行 (紧凑同行布局，充分利用右侧横向空间) -->
  <div class="flex items-center gap-2 mb-2">
    {#if roots.length > 0}
      <div class="flex gap-1.5 shrink-0 overflow-x-auto max-w-[50%]">
        {#each roots as r}
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap {curRoot?.path === r.path ? 'btn-primary' : 'btn-secondary'}"
            onclick={() => selectRoot(r)}
          >
            {r.name.includes('外部') || r.name.toLowerCase().includes('external') ? '📦 ' + r.name : '📁 ' + r.name} <!-- i18n-ignore: badge icon -->
          </button>
        {/each}
      </div>
    {/if}

    <div class="flex-1 min-w-0">
      <LocalSearchBox
        bind:value={filterKw}
        placeholder={t('folder.searchPlaceholder')}
        historyKey="wyyyy_folder_search_history"
        hideIcon={true}
      />
    </div>
  </div>

  <!-- Global Tree Control (全部展开 / 折叠 / 刷新) -->
  <div class="mb-2.5 flex items-center justify-between gap-1.5 flex-wrap">
    <div class="flex gap-1.5 flex-wrap">
      <button
        type="button"
        class="btn-secondary px-2.5 py-1 text-xs cursor-pointer active:scale-95 transition-all"
        onclick={() => expandSignal = Date.now()}
        title={t('folder.expandAllTooltip')}
      >
        {t('folder.expandAll')}
      </button>
      <button
        type="button"
        class="btn-secondary px-2.5 py-1 text-xs cursor-pointer active:scale-95 transition-all"
        onclick={() => expandSignal = -Date.now()}
        title={t('folder.collapseAllTooltip')}
      >
        {t('folder.collapseAll')}
      </button>
      <button
        type="button"
        class="btn-secondary px-2.5 py-1 text-xs cursor-pointer active:scale-95 transition-all"
        onclick={() => curRoot && loadBrowse(curRoot.path, true)}
        title={t('folder.refreshLibraryTooltip')}
      >
        🔄 {t('common.refresh')}
      </button>
    </div>
  </div>

  <!-- Root Stats -->
  {#if curRoot}
    <div class="bg-[var(--stat-bar-bg,#1e293b)]/30 border border-[var(--border-subtle)] rounded-xl p-2.5 px-3.5 mb-2 flex justify-between items-center flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <span class="font-bold text-xs text-[var(--text-main)]">📁 {curRoot.name}</span>
        <span class="bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 px-2 py-0.5 rounded-full text-[11px] text-[var(--text-muted)]">
          {t('folder.statsSummary', { dirs: tree.filter((t: any) => t.directory).length, tracks: tree.filter((t: any) => !t.directory).length })}
        </span>
      </div>
      <div class="flex gap-1.5">
        <button
          type="button"
          class="btn-primary px-3 py-1 text-xs cursor-pointer active:scale-95 transition-all"
          onclick={() => playFolder(curRoot.path, curRoot.name)}
        >
          {t('folder.playWholeLibrary')}
        </button>
      </div>
    </div>
  {/if}

  <!-- Recursive Tree List -->
  <div class="scrollable-list border border-[var(--border-subtle)] rounded-xl bg-[var(--card-bg)] min-w-0">
    {#each tree.filter((t: any) => !filterKw || matchesKeyword((t.songName || t.name || '') + ' ' + (t.artist || '') + ' ' + t.path, filterKw)) as item}
      <FolderNode {item} level={0} {expandSignal} onPlayFolder={playFolder} onPlaySingle={playSingle} onReveal={revealItem} />
    {:else}
      <div class="py-6 px-4 text-center text-[var(--text-muted)] text-xs">{t('folder.emptyDirectory')}</div>
    {/each}
  </div>
</div>
