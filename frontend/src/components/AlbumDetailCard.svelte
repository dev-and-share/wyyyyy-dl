<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import { showToast } from '../lib/toast.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack } from '../lib/trackStatus.svelte';
  import { t } from '../lib/i18n';

  let {
    album,
    albumLoading = false,
    open = $bindable(false),
    flat = false,
    currentAlbumId = $bindable(''),
    curTrack = null,
    playing = false,
    likedSet = new Set<number>(),
    downloadedSet = new Set<number>(),
    onLoadAlbum,
    onDownloadFullAlbum,
    onPlayFullAlbum,
    onDownloadSingleTrack,
    onToggleLike,
    onPlayQueue,
    onReveal,
    onSong
  } = $props<{
    album: any;
    albumLoading?: boolean;
    open?: boolean;
    flat?: boolean;
    currentAlbumId: string;
    curTrack?: any;
    playing?: boolean;
    likedSet?: Set<number>;
    downloadedSet?: Set<number>;
    onLoadAlbum: (id?: string) => void;
    onDownloadFullAlbum: () => void;
    onPlayFullAlbum: () => void;
    onDownloadSingleTrack: (id: string) => void;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onPlayQueue?: (tracks: any[]) => void;
    onReveal?: (item: any) => void;
    onSong?: (id: string) => void;
  }>();

  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);

  let curAlbum = $derived(album?.album || album);
  let songs = $derived(curAlbum?.songs || album?.songs || []);

  function formatPublishTime(t: any): string {
    if (!t) return '-';
    if (typeof t === 'number' || (typeof t === 'string' && /^\d+$/.test(t))) {
      const d = new Date(Number(t));
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    return String(t);
  }

  function openTrackSheet(s: any, isLocal: boolean, artistName: string, isPlayingThis: boolean) {
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
                      cover: curAlbum?.coverImgUrl || curAlbum?.picUrl || DEFAULT_VINYL_COVER,
                      isLocal
                    }
                  ])
              }
            ]
          : []),
        ...(isLocal && onReveal
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
                onclick: () => onDownloadSingleTrack(String(s.id))
              }
            ]),
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

<AccordionCard title={t('album.accordionTitle')} bind:open {flat} accent="blue">
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input
      type="text"
      placeholder={t('album.inputIdPlaceholderWithEnter')}
      class="flex-1 min-w-0"
      bind:value={currentAlbumId}
      onkeydown={(e) => e.key === 'Enter' && onLoadAlbum()}
    />
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => onLoadAlbum()}>
      {t('album.parse')}<span class="hidden sm:inline">{t('album.albumWord')}</span>
    </button>
  </div>

  {#if albumLoading}
    <div style="padding:24px; text-align:center; color:var(--text-secondary); font-size:14px;">
      {t('album.parsing')}
    </div>
  {:else if curAlbum && (curAlbum.name || curAlbum.id || songs.length > 0)}
    {@const headerArtist = formatArtist(curAlbum.artist || curAlbum.artists) || t('common.unknownArtist')}
    <DetailHeaderCard
      cover={curAlbum.coverImgUrl || curAlbum.picUrl || DEFAULT_VINYL_COVER}
      title={curAlbum.name || t('album.unknown')}
      subtitle={`${t('album.artistColon', { artist: headerArtist })} | ${t('album.publishTimeColon', { time: formatPublishTime(curAlbum.publishTime) })}`}
      subDetail={t('album.containsTracks', { count: songs.length })}
    >
      <button class="btn-primary" onclick={onDownloadFullAlbum}>{t('album.downloadToPc')}</button>
      <button class="btn-secondary" onclick={onPlayFullAlbum}>{t('album.playAlbum')}</button>
    </DetailHeaderCard>

    <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">
      {t('album.trackListHeader', { count: songs.length })}
    </h4>
    <ul class="data-list scrollable-list">
      {#each songs as s, i}
        {@const artistName = formatArtist(s.artist || s.ar || s.artists || curAlbum.artist || '')}
        {@const status = getTrackSourceStatus(s.id, s.isLocal, curTrack)}
        {@const isPlayingThis = isSameTrack(curTrack, s)}
        {@const playLabel = getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'short' })}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <button
              type="button"
              class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
              onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: curAlbum.coverImgUrl || curAlbum.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }]))}
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
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: curAlbum.coverImgUrl || curAlbum.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              {#if status.isServer}
                <SlotBtn
                  onclick={() => onReveal && onReveal({ id: s.id, name: s.name, artist: artistName })}
                  title={t('player.revealOnDisk')}
                >
                  {t('common.reveal')}
                </SlotBtn>
              {:else}
                <SlotBtn onclick={() => onDownloadSingleTrack(String(s.id))}>
                  {t('download.downloadSingle')}
                </SlotBtn>
              {/if}
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(s.id))}>{t('common.detailShort')}</SlotBtn>
              {/if}
            </div>

            <!-- 📱 SP 移动端常用功能 + ··· 抽屉 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: curAlbum.coverImgUrl || curAlbum.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openTrackSheet(s, status.isLocal, artistName, isPlayingThis)}
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
  {:else}
    <div class="empty-placeholder-card">
      <div class="empty-icon">💽</div>
      <div class="empty-title">{t('album.emptyPrompt')}</div>
    </div>
  {/if}
</AccordionCard>

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}
