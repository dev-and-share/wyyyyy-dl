<script lang="ts">
  import { onMount } from 'svelte';
  import { formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { cachedSongIdSet, cacheTrackToBrowser } from '../lib/pwaCache.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack } from '../lib/trackStatus.svelte';
  import { api } from '../lib/api';
  import { t } from '../lib/i18n';

  let {
    artist = null,
    artistLoading = false,
    open = $bindable(false),
    flat = false,
    currentArtistId = $bindable(''),
    curTrack = null,
    playing = false,
    likedSet = new Set<number>(),
    downloadedSet = new Set<number>(),
    onLoadArtist,
    onPlayQueue,
    onSong,
    onToggleLike,
    onReveal,
    showToast
  } = $props<{
    artist?: any;
    artistLoading?: boolean;
    open?: boolean;
    flat?: boolean;
    currentArtistId: string;
    curTrack?: any;
    playing?: boolean;
    likedSet?: Set<number>;
    downloadedSet?: Set<number>;
    onLoadArtist?: (id?: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onSong?: (id: string) => void;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);

  let innerArtist = $state<any>(null);
  let innerLoading = $state(false);
  let forking = $state(false);
  let cachingBatch = $state(false);

  let displayArtist = $derived(artist || innerArtist);
  let displayLoading = $derived(artistLoading || innerLoading);

  async function handleLoad(id?: string) {
    if (onLoadArtist) {
      onLoadArtist(id);
      return;
    }
    const targetId = id || currentArtistId;
    if (!targetId) {
      showToast(t('artist.enterId'), 'warning');
      return;
    }
    currentArtistId = targetId;
    open = true;
    const cached = getApiCache('artist_' + targetId);
    if (cached?.data?.artist || cached?.data) {
      innerArtist = cached.data.artist || cached.data;
    } else {
      innerLoading = true;
    }
    try {
      const res = await api.artist(targetId);
      innerLoading = false;
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || t('artist.fetchFailed'), 'warning');
        return;
      }
      innerArtist = res?.data?.artist || res?.data || res;
      setApiCache('artist_' + targetId, res.data);
    } catch (e: any) {
      innerLoading = false;
      showToast(t('artist.fetchFailedWithMsg', { message: e.message || e }), 'error');
    }
  }

  $effect(() => {
    if (currentArtistId && open && (!displayArtist || String(displayArtist.id) !== currentArtistId)) {
      handleLoad(currentArtistId);
    }
  });

  function playAllArtistTopSongs() {
    const songs = displayArtist?.songs || [];
    if (!songs.length || !onPlayQueue) return;
    const q = songs.map((s: any) => {
      const art = formatArtist(s.artist || s.ar || s.artists || displayArtist?.name || '');
      const status = getTrackSourceStatus(s.id, s.isLocal, curTrack);
      return {
        id: s.id,
        name: s.name,
        artist: art,
        cover: s.picUrl || s.al?.picUrl || displayArtist?.coverImgUrl || DEFAULT_VINYL_COVER,
        isLocal: status.isLocal
      };
    });
    onPlayQueue(q, 0);
    showToast(t('artist.playingTopToast', { name: displayArtist.name, count: q.length }), 'success');
  }

  async function forkTopSongsToPlaylist() {
    const songs = displayArtist?.songs || [];
    if (!songs.length) {
      showToast(t('artist.noSongsToCollect'), 'warning');
      return;
    }
    const plName = t('artist.topSongsPlaylistName', { name: displayArtist.name || t('artist.artistWord'), count: songs.length });
    const trackIds = songs.map((s: any) => s.id).join(',');
    forking = true;
    try {
      const res = await api.playlistFork(plName, false, trackIds);
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || t('artist.forkFailedWithMsg', { message: res.msg }), 'error');
        return;
      }
      showToast(t('artist.forkSuccess', { name: plName }), 'success', 3500);
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));
    } catch (e: any) {
      showToast(t('artist.forkFailedWithMsg', { message: e.message || e }), 'error');
    } finally {
      forking = false;
    }
  }

  async function cacheAllTopSongs() {
    const songs = displayArtist?.songs || [];
    if (!songs.length) return;
    cachingBatch = true;
    showToast(t('artist.cachingBatchStart', { name: displayArtist.name }), 'info', 2000);
    let successCount = 0;
    for (const s of songs) {
      try {
        const res = await cacheTrackToBrowser({
          id: s.id,
          name: s.name,
          artist: formatArtist(s.artist || s.ar || s.artists || displayArtist?.name || ''),
          cover: s.picUrl || s.al?.picUrl || displayArtist?.coverImgUrl || DEFAULT_VINYL_COVER,
          album: s.album || s.al?.name || ''
        });
        if (res.success) successCount++;
      } catch {}
    }
    cachingBatch = false;
    showToast(t('artist.cachingBatchComplete', { success: successCount, total: songs.length }), 'success');
  }

  function openTrackSheet(s: any, isLocal: boolean, isPhone: boolean, isServer: boolean, artistName: string, isPlayingThis: boolean) {
    openSheet({
      title: s.name,
      subtitle: artistName || t('common.unknownArtist'),
      actions: [
        ...(onPlayQueue
          ? [
              {
                label: getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal, variant: 'full' }),
                style: 'primary' as const,
                onclick: () =>
                  onPlayQueue([
                    {
                      id: s.id,
                      name: s.name,
                      artist: artistName,
                      cover: s.picUrl || s.al?.picUrl || displayArtist?.coverImgUrl || DEFAULT_VINYL_COVER,
                      isLocal
                    }
                  ])
              }
            ]
          : []),
        ...(isServer && onReveal
          ? [
              {
                label: t('player.revealOnDisk'),
                style: 'default' as const,
                onclick: () => onReveal({ id: s.id, name: s.name, artist: artistName })
              }
            ]
          : [
              {
                label: t('search.downloadTrackToServer'),
                style: 'default' as const,
                onclick: () => {
                  api.downloadSingle(String(s.id)).then(() => {
                    showToast(t('download.submitSuccessWithName', { name: s.name }), 'info');
                    window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
                  }).catch((e: any) => showToast(t('download.submitFailedWithMsg', { message: e }), 'error'));
                }
              }
            ]),
        {
          label: isPhone ? t('search.reCacheToPhone') : t('search.cacheToPhonePwa'),
          style: 'default' as const,
          onclick: () => {
            cacheTrackToBrowser({
              id: s.id,
              name: s.name,
              artist: artistName,
              cover: s.picUrl || s.al?.picUrl || displayArtist?.coverImgUrl || DEFAULT_VINYL_COVER,
              album: s.album || s.al?.name || ''
            }).then(r => showToast(r.msg, r.success ? 'success' : 'warning'));
          }
        },
        ...(onSong
          ? [
              {
                label: t('search.songDetail'),
                style: 'default' as const,
                onclick: () => onSong(String(s.id))
              }
            ]
          : []),
        {
          label: t('search.actionCollectToPlaylist'),
          style: 'default' as const,
          onclick: () => {
            addToPlaylistSong = { id: s.id, name: s.name, artist: artistName };
          }
        },
        ...(onToggleLike
          ? [
              {
                label: likedSet.has(Number(s.id)) ? t('search.actionUnlike') : t('search.actionLike'),
                style: 'default' as const,
                onclick: () => onToggleLike(Number(s.id), s.name, artistName)
              }
            ]
          : [])
      ]
    });
  }
</script>

<AccordionCard title={t('artist.accordionTitle')} bind:open {flat} accent="purple">
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input
      type="text"
      placeholder={t('artist.inputIdPlaceholderWithEnter')}
      class="flex-1 min-w-0"
      bind:value={currentArtistId}
      onkeydown={(e) => e.key === 'Enter' && handleLoad()}
    />
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => handleLoad()}>
      {t('artist.parse')}<span class="hidden sm:inline">{t('artist.artistWord')}</span>
    </button>
  </div>

  {#if displayLoading}
    <div style="padding:24px; text-align:center; color:var(--text-secondary); font-size:14px;">
      {t('artist.parsingTop50')}
    </div>
  {:else if displayArtist}
    <DetailHeaderCard
      cover={displayArtist.coverImgUrl || DEFAULT_VINYL_COVER}
      title={displayArtist.name || t('artist.unknown')}
      subtitle={`${t('artist.songCount', { count: displayArtist.musicSize || 0 })} | ${t('artist.albumCount', { count: displayArtist.albumSize || 0 })}`}
      subDetail={t('artist.subDetailTop', { count: displayArtist.songs?.length || 0 })}
    >
      <button class="btn-primary" onclick={playAllArtistTopSongs}>{t('artist.playAllTop')}</button>
      <button class="btn-secondary !text-blue-500 !border-blue-500/30 font-semibold" onclick={forkTopSongsToPlaylist} disabled={forking}>
        {forking ? t('artist.forking') : t('artist.collectAsPlaylist')}
      </button>
      <button class="btn-secondary hidden sm:inline-flex" onclick={cacheAllTopSongs} disabled={cachingBatch}>
        {cachingBatch ? t('artist.caching') : t('artist.cacheAllTop')}
      </button>
    </DetailHeaderCard>

    {#if displayArtist.briefDesc}
      <div class="my-2 p-2.5 rounded-lg bg-black/5 dark:bg-white/[0.04] text-xs text-[var(--text-secondary)] leading-relaxed max-h-24 overflow-y-auto">
        {displayArtist.briefDesc}
      </div>
    {/if}

    <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">
      {t('artist.topListHeader', { count: displayArtist.songs ? displayArtist.songs.length : 0 })}
    </h4>
    <ul class="data-list scrollable-list">
      {#each (displayArtist.songs || []) as s, i}
        {@const artistName = formatArtist(s.artist || s.ar || s.artists || displayArtist.name || '')}
        {@const status = getTrackSourceStatus(s.id, s.isLocal, curTrack)}
        {@const isPlayingThis = isSameTrack(curTrack, s)}
        {@const playLabel = getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'short' })}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <button
              type="button"
              class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
              onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }]))}
            >
              {i + 1}. {s.name}
            </button>
            {#if artistName}<span class="text-xs text-[var(--text-secondary)] truncate"> - {artistName}</span>{/if}
            <TrackSourceBadge id={s.id} isLocal={s.isLocal} {curTrack} class="ml-1.5" />
          </div>
          <div class="track-action-group">
            <!-- 💻 PC 桌面端快捷操作 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              {#if onToggleLike}
                <TrackLikeBtn liked={likedSet.has(Number(s.id))} onclick={() => onToggleLike(Number(s.id), s.name, artistName)} />
              {/if}
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              {#if status.isServer}
                <SlotBtn onclick={() => onReveal && onReveal({ id: s.id, name: s.name, artist: artistName })}>{t('common.reveal')}</SlotBtn>
              {:else}
                <SlotBtn onclick={() => {
                  api.downloadSingle(String(s.id)).then(() => {
                    showToast(t('download.submitSuccessWithName', { name: s.name }), 'info');
                    window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
                  }).catch((e: any) => showToast(t('download.submitFailedWithMsg', { message: e }), 'error'));
                }}>{t('download.downloadSingle')}</SlotBtn>
              {/if}
              <SlotBtn onclick={() => {
                cacheTrackToBrowser({
                  id: s.id,
                  name: s.name,
                  artist: artistName,
                  cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER,
                  album: s.album || s.al?.name || ''
                }).then(r => showToast(r.msg, r.success ? 'success' : 'warning'));
              }}>{status.isPhone ? t('search.cachedShort') : t('search.cacheShort')}</SlotBtn>
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(s.id))}>{t('common.detailShort')}</SlotBtn>
              {/if}
            </div>

            <!-- 📱 SP 移动端常用功能 + ··· 抽屉 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openTrackSheet(s, status.isLocal, status.isPhone, status.isServer, artistName, isPlayingThis)}
                title={t('common.moreActions')}
                aria-label={t('common.moreActions')}
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</AccordionCard>

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}
