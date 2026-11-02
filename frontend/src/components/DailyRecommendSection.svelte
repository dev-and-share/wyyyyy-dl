<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl, deleteApiCache } from '../lib/utils';
  import { toPlayerTrack } from '../lib/playerHelper';
  import { myPlaylists, loadMyPlaylists, getLastBackupPlaylist, setLastBackupPlaylist, updatePlaylistTrackCount } from '../lib/playlist.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack } from '../lib/trackStatus.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { t, formatDate } from '../lib/i18n';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import Modal from './Modal.svelte';
  import CreatePlaylistModal from './CreatePlaylistModal.svelte';

  let {
    open = $bindable(false),
    flat = false,
    onToggle,
    curTrack = null,
    playing = false,
    likedSet = new Set<number>(),
    onToggleLike,
    onPlayQueue,
    onSong,
    onAlbum,
    onReveal,
    showToast
  } = $props<{
    open?: boolean;
    flat?: boolean;
    onToggle?: () => void;
    curTrack?: any;
    playing?: boolean;
    likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onSong?: (id: string) => void;
    onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let loading = $state(false);
  let errorMsg = $state('');
  let recommendTracks = $state<any[]>([]);
  let lastBackup = $state<{ id: string; name: string } | null>(getLastBackupPlaylist());
  let isBackingUp = $state(false);
  let isDownloadingAll = $state(false);
  let showSelectModal = $state(false);
  let showCreateModal = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);

  // 今日日期格式化
  const todayText = $derived(formatDate(Date.now(), { month: '2-digit', day: '2-digit' }));

  async function loadRecommend(force = false) {
    if (recommendTracks.length > 0 && !force) return;
    loading = true;
    errorMsg = '';
    try {
      const res = await api.recommendSongs();
      if (res?.code === '000000' && Array.isArray(res.data)) {
        recommendTracks = res.data;
      } else {
        errorMsg = res?.msg || t('recommend.failedCookie');
      }
    } catch (e: any) {
      errorMsg = e?.message || t('recommend.failedNetwork');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (open && recommendTracks.length === 0 && !loading && !errorMsg) {
      loadRecommend();
    }
  });

  onMount(() => {
    if (open) {
      loadRecommend();
    }
  });

  // 播放整单今日推荐
  function handlePlayAll() {
    if (!recommendTracks.length || !onPlayQueue) return;
    const list = recommendTracks.map(t =>
      toPlayerTrack(t, {
        artist: typeof t.artists === 'string' ? t.artists : formatArtist(t.artists || t.ar),
        isLocal: t.isLocal
      })
    );
    onPlayQueue(list, 0);
    showToast(t('recommend.playingAll', { count: list.length }), 'success');
  }

  // 批量下载今日推荐
  async function handleDownloadAll() {
    if (!recommendTracks.length || isDownloadingAll) return;
    isDownloadingAll = true;
    showToast(t('recommend.batchSubmitting', { count: recommendTracks.length }), 'info');
    let successCount = 0;
    try {
      for (const t of recommendTracks) {
        try {
          await api.downloadSingle(String(t.id));
          successCount++;
        } catch {}
      }
      showToast(t('recommend.batchSuccess', { count: successCount }), 'success');
      window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
    } catch (e: any) {
      showToast(t('recommend.batchFailed', { error: e.message || e }), 'error');
    } finally {
      isDownloadingAll = false;
    }
  }

  // 真·一键备份今日推荐
  async function handleOneClickBackup() {
    if (!recommendTracks.length || isBackingUp) return;
    if (!lastBackup) {
      showSelectModal = true;
      return;
    }
    isBackingUp = true;
    const trackIds = recommendTracks.map(t => t.id).join(',');
    try {
      const res = await api.playlistAdd(lastBackup.id, trackIds);
      if (res?.code === '000000') {
        const addedCount = typeof res.data?.addedCount === 'number' ? res.data.addedCount : recommendTracks.length;
        if (addedCount > 0) {
          updatePlaylistTrackCount(lastBackup.id, addedCount);
        }
        const toastMsg = (res.msg && res.msg !== 'success' && res.msg !== '成功') // i18n-ignore: backend raw success message
          ? res.msg
          : t('recommend.backupSuccess', { count: recommendTracks.length, name: lastBackup.name });
        showToast(toastMsg, 'success');
        deleteApiCache('playlist_' + lastBackup.id);
      } else {
        showToast(res?.msg || t('recommend.backupFailed'), 'warning');
      }
    } catch (e: any) {
      showToast(t('recommend.backupError', { error: e.message || e }), 'error');
    } finally {
      isBackingUp = false;
    }
  }

  // 选定或更换目标歌单并执行备份
  async function handleSelectPlaylistAndBackup(pl: any) {
    showSelectModal = false;
    lastBackup = { id: String(pl.id), name: pl.name };
    setLastBackupPlaylist(pl.id, pl.name);
    await handleOneClickBackup();
  }

  // 移动端更多操作
  function openRecommendTrackSheet(tItem: any, isPlayingThis: boolean) {
    const artistName = typeof tItem.artists === 'string' ? tItem.artists : formatArtist(tItem.artists || tItem.ar);
    const status = getTrackSourceStatus(tItem.id, tItem.isLocal, curTrack);
    openSheet({
      title: tItem.name,
      subtitle: artistName || t('player.unknownArtist'),
      actions: [
        ...(onPlayQueue ? [{
          label: getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'full' }),
          style: 'primary' as const,
          onclick: () => onPlayQueue([toPlayerTrack(tItem, { artist: artistName, isLocal: status.isLocal })])
        }] : []),
        { label: t('recommend.actionDownload'), style: 'default' as const, onclick: () => api.downloadSingle(String(tItem.id)).then(() => showToast(t('drawer.downloadSubmitted', { name: tItem.name }), 'success')) },
        { label: t('recommend.actionPlaylist'), style: 'default' as const, onclick: () => { addToPlaylistSong = { id: tItem.id, name: tItem.name, artist: artistName }; } },
        ...(onSong ? [{ label: t('recommend.actionDetail'), style: 'default' as const, onclick: () => onSong(String(tItem.id)) }] : []),
        ...(onToggleLike ? [{ label: likedSet.has(Number(tItem.id)) ? t('recommend.actionUnlike') : t('recommend.actionLike'), style: 'default' as const, onclick: () => onToggleLike(Number(tItem.id), tItem.name, artistName) }] : [])
      ]
    });
  }
</script>

<AccordionCard title={t('recommend.title')} bind:open {flat} accent="amber" onToggle={onToggle}>
  <!-- 头部控制栏：日期 + 核心快捷动作组 -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 py-1 mb-3 border-b border-[var(--border-subtle)] pb-3">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1">
        <span>📅</span>
        <span>{todayText}</span>
      </span>
      <span class="text-xs text-[var(--text-muted)] font-medium">
        {#if loading}
          {t('recommend.updating')}
        {:else if recommendTracks.length}
          {t('recommend.subtitle', { count: recommendTracks.length })}
        {:else}
          {t('recommend.updateTime')}
        {/if}
      </span>
    </div>

    <!-- 快捷操作按钮组 -->
    <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
      {#if recommendTracks.length > 0}
        <button
          type="button"
          class="btn-primary text-xs py-1.5 px-3 rounded-lg font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
          onclick={handlePlayAll}
        >
          <span>▶️</span>
          <span>{t('recommend.playAll')}</span>
        </button>

        <button
          type="button"
          disabled={isDownloadingAll}
          class="btn-secondary text-xs py-1.5 px-3 rounded-lg font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
          onclick={handleDownloadAll}
        >
          <span>{isDownloadingAll ? '🔄' : '📥'}</span>
          <span>{isDownloadingAll ? t('common.submitting') : t('recommend.downloadAll')}</span>
        </button>

        <!-- 真·一键备份今日推荐 -->
        {#if lastBackup}
          <div class="inline-flex rounded-lg border border-emerald-500/30 bg-emerald-500/10 overflow-hidden shrink-0">
            <button
              type="button"
              disabled={isBackingUp}
              class="text-xs py-1.5 px-2.5 font-medium text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1 border-none bg-transparent disabled:opacity-50"
              onclick={handleOneClickBackup}
              title={t('recommend.backupToTooltip', { name: lastBackup.name })}
            >
              <span>{isBackingUp ? '⏳' : '➕'}</span>
              <span class="truncate max-w-[130px] sm:max-w-[180px]">{isBackingUp ? t('recommend.backingUp') : t('recommend.backupTo', { name: lastBackup.name })}</span>
            </button>
            <button
              type="button"
              class="text-[11px] px-2 text-emerald-300 hover:text-white border-l border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer bg-transparent transition-all"
              onclick={() => showSelectModal = true}
              title={t('recommend.backupChangeTooltip')}
            >
              {t('recommend.backupChange')}
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="btn-secondary text-xs py-1.5 px-3 rounded-lg font-medium flex items-center gap-1 cursor-pointer active:scale-95 transition-all text-emerald-400 border-emerald-500/30"
            onclick={() => showSelectModal = true}
          >
            <span>➕</span>
            <span>{t('recommend.backupBtn')}</span>
          </button>
        {/if}
      {/if}

      <button
        type="button"
        class="text-xs py-1.5 px-2 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer flex items-center gap-1 ml-auto sm:ml-0"
        onclick={() => loadRecommend(true)}
        title={t('recommend.refreshTooltip')}
      >
        <span>🔄</span>
        <span class="hidden sm:inline">{t('common.refresh')}</span>
      </button>
    </div>
  </div>

  <!-- 内容展示区 -->
  {#if loading}
    <div class="py-12 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center gap-3">
      <div class="w-7 h-7 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin"></div>
      <span>{t('recommend.syncing')}</span>
    </div>
  {:else if errorMsg}
    <div class="py-10 px-4 text-center flex flex-col items-center gap-2.5 bg-black/5 dark:bg-white/[0.02] rounded-xl border border-dashed border-black/10 dark:border-white/10 my-2">
      <span class="text-2xl">🔒</span>
      <div class="text-xs text-[var(--text-main)] font-semibold">{errorMsg}</div>
      <div class="text-[11px] text-[var(--text-muted)] max-w-sm leading-relaxed">
        {t('recommend.cookieTip')}
      </div>
      <button
        type="button"
        class="btn-primary text-xs py-1.5 px-4 rounded-lg mt-1 cursor-pointer"
        onclick={() => loadRecommend(true)}
      >
        {t('recommend.reFetch')}
      </button>
    </div>
  {:else if recommendTracks.length > 0}
    <ul class="data-list scrollable-list max-h-[520px]">
      {#each recommendTracks as trackItem, idx}
        {@const artistName = typeof trackItem.artists === 'string' ? trackItem.artists : formatArtist(trackItem.artists || trackItem.ar)}
        {@const status = getTrackSourceStatus(trackItem.id, trackItem.isLocal, curTrack)}
        {@const isPlayingThis = isSameTrack(curTrack, trackItem)}
        {@const playLabel = getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'short' })}
        {@const coverUrl = trackItem.picUrl || trackItem.al?.picUrl || ''}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <!-- 封面与曲名 -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            {#if coverUrl}
              <div class="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg overflow-hidden bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs">
                <img
                  src={formatCoverUrl(coverUrl, 120)}
                  alt={trackItem.name}
                  class="w-full h-full object-cover"
                  loading="lazy"
                  onerror={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_VINYL_COVER; }}
                />
              </div>
            {/if}

            <div class="flex flex-col min-w-0 flex-1 justify-center py-0.5">
              <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
                <button
                  type="button"
                  class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors text-xs sm:text-sm leading-snug"
                  onclick={() => onSong ? onSong(String(trackItem.id)) : (onPlayQueue && onPlayQueue([toPlayerTrack(trackItem, { artist: artistName, isLocal: status.isLocal })]))}
                >
                  <span class="text-[var(--text-muted)] font-mono mr-1 text-[11px]">{idx + 1}.</span>{trackItem.name}
                </button>
                <TrackSourceBadge id={trackItem.id} isLocal={trackItem.isLocal} {curTrack} class="shrink-0" />
                {#if trackItem.reason}
                  <span class="text-[10px] text-amber-500 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 shrink-0 font-normal">
                    {trackItem.reason}
                  </span>
                {/if}
              </div>

              <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                {#if artistName}
                  <span class="text-[var(--text-secondary)] truncate">{artistName}</span>
                  <span class="opacity-40">·</span>
                {/if}
                {#if trackItem.album}
                  <span class="text-[var(--text-muted)] truncate">{trackItem.album}</span>
                  <span class="opacity-40">·</span>
                {/if}
                <span class="font-mono opacity-80 shrink-0">ID:{trackItem.id}</span>
              </div>
            </div>
          </div>

          <!-- 操作按钮组 -->
          <div class="track-action-group">
            <!-- 💻 PC 桌面端快捷按钮 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              {#if onToggleLike}
                <TrackLikeBtn liked={likedSet.has(Number(trackItem.id))} onclick={() => onToggleLike(Number(trackItem.id), trackItem.name, artistName)} />
              {/if}
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([toPlayerTrack(trackItem, { artist: artistName, isLocal: status.isLocal })])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              <SlotBtn onclick={() => api.downloadSingle(String(trackItem.id)).then(() => showToast(t('drawer.downloadSubmitted', { name: trackItem.name }), 'success'))}>
                {t('recommend.btnDownload')}
              </SlotBtn>
              <SlotBtn onclick={() => addToPlaylistSong = { id: trackItem.id, name: trackItem.name, artist: artistName }}>
                {t('recommend.btnPlaylist')}
              </SlotBtn>
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(trackItem.id))}>{t('recommend.btnDetail')}</SlotBtn>
              {/if}
            </div>

            <!-- 📱 SP 移动端操作按钮 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([toPlayerTrack(trackItem, { artist: artistName, isLocal: status.isLocal })])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openRecommendTrackSheet(trackItem, isPlayingThis)}
                title={t('recommend.moreActions')}
                aria-label={t('recommend.moreActions')}
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="py-12 text-center text-xs text-[var(--text-muted)]">
      {t('recommend.empty')}
    </div>
  {/if}
</AccordionCard>

<!-- 选择/更换备份目标歌单 Modal -->
{#if showSelectModal}
  <Modal title={t('recommend.selectBackupTitle')} icon="📂" maxWidth="max-w-[480px]" onClose={() => showSelectModal = false}>
    <div class="text-xs text-[var(--text-secondary)] mb-3">
      {t('recommend.selectBackupTip')}
    </div>

    <div class="flex justify-between items-center mb-2">
      <span class="text-xs font-semibold text-[var(--text-main)]">{t('recommend.myCreatedList')}</span>
      <button
        type="button"
        class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-transparent border-none cursor-pointer flex items-center gap-1"
        onclick={() => showCreateModal = true}
      >
        ➕ {t('playlist.create')}
      </button>
    </div>

    <div class="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
      {#each myPlaylists.filter(p => !p.subscribed) as pl}
        <div
          class="flex justify-between items-center p-2.5 rounded-xl border border-black/5 dark:border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="text-sm">📁</span>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-[var(--text-main)] truncate">{pl.name}</div>
              <div class="text-[10px] text-[var(--text-muted)]">{pl.trackCount || 0} {t('common.unit.tracks')}</div>
            </div>
          </div>
          <button
            type="button"
            class="btn-primary text-xs px-3 py-1 rounded-lg font-medium shrink-0 cursor-pointer"
            onclick={() => handleSelectPlaylistAndBackup(pl)}
          >
            {t('recommend.backupToThis')}
          </button>
        </div>
      {:else}
        <div class="py-8 text-center text-xs text-[var(--text-muted)]">
          {t('playlist.noCreatedPrompt')}
        </div>
      {/each}
    </div>

  </Modal>
{/if}

<!-- 新建歌单 Modal -->
{#if showCreateModal}
  <CreatePlaylistModal
    onClose={() => showCreateModal = false}
    onSuccess={(newId) => {
      showToast(t('toast.playlist.created'), 'success');
      loadMyPlaylists('created').catch(() => {});
    }}
  />
{/if}

<!-- 单曲收藏到歌单 Modal -->
{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}
