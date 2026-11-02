<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl } from '../lib/utils';
  import type { Track } from '../lib/types';
  import { toPlayerTrack } from '../lib/playerHelper';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack } from '../lib/trackStatus.svelte';
  import { t } from '../lib/i18n';

  let {
    sResults = [],
    sType = '1',
    searchLoading = false,
    hasSearched = false,
    curTrack = null,
    playing = false,
    likedSet = new Set<number>(),
    onToggleLike,
    onPlaylist,
    onAlbum,
    onPlayQueue,
    onSong,
    onReveal,
    onViewArtist,
    handlePlayPlaylist,
    handleDownloadPlaylist,
    showToast
  } = $props<{
    sResults: any[];
    sType: string;
    searchLoading: boolean;
    hasSearched: boolean;
    curTrack?: Track | null;
    playing?: boolean;
    likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onPlaylist: (id: string) => void;
    onAlbum: (id: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onSong?: (id: string) => void;
    onReveal?: (item: any) => void;
    onViewArtist: (id: string) => void;
    handlePlayPlaylist: (id: string, name: string) => Promise<void>;
    handleDownloadPlaylist: (id: string, name: string) => Promise<void>;
    showToast: (m: string, t?: string) => void;
  }>();

  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('common.copiedWithLabel', { label, text }), 'success');
    } catch {
      showToast(t('common.copyFailedWithText', { text }), 'warning');
    }
  }

  function openSearchTrackSheet(r: any, isLocal: boolean, artistName: string, isPlayingThis: boolean) {
    openSheet({
      title: r.name,
      subtitle: artistName || t('common.unknownArtist'),
      actions: [
        ...(onPlayQueue
          ? [
              {
                label: getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal, variant: 'full' }),
                style: 'primary' as const,
                onclick: () =>
                  onPlayQueue([toPlayerTrack(r, { artist: artistName, isLocal })])
              }
            ]
          : []),
        ...(isLocal && onReveal
          ? [
              {
                label: t('player.revealOnDisk'),
                style: 'default' as const,
                onclick: () => onReveal({ id: r.id, name: r.name, artist: artistName })
              }
            ]
          : []),
        ...(onSong
          ? [
              {
                label: t('search.viewDetailDownload'),
                style: 'default' as const,
                onclick: () => onSong(String(r.id))
              }
            ]
          : []),
        {
          label: t('search.actionCollectToPlaylist'),
          style: 'default' as const,
          onclick: () => {
            addToPlaylistSong = { id: r.id, name: r.name, artist: artistName };
          }
        },
        ...(onToggleLike
          ? [
              {
                label: likedSet.has(Number(r.id)) ? t('search.actionUnlike') : t('search.actionLike'),
                style: 'default' as const,
                onclick: () => onToggleLike(Number(r.id), r.name, artistName)
              }
            ]
          : []),
        {
          label: t('search.actionCopySongId'),
          style: 'default' as const,
          onclick: () => copyText(String(r.id), t('common.songId'))
        }
      ]
    });
  }

  function openPlaylistSheet(pl: any) {
    openSheet({
      title: pl.name,
      subtitle: t('playlist.playlistSubtitle', { count: pl.trackCount || 0, id: pl.id }),
      actions: [
        ...(onPlayQueue
          ? [
              {
                label: t('playlist.playAllLong'),
                style: 'primary' as const,
                onclick: () => handlePlayPlaylist(String(pl.id), pl.name)
              }
            ]
          : []),
        {
          label: t('playlist.downloadAllSongs'),
          style: 'default' as const,
          onclick: () => handleDownloadPlaylist(String(pl.id), pl.name)
        },
        {
          label: t('playlist.viewDetailsAndTracks'),
          style: 'default' as const,
          onclick: () => onPlaylist(String(pl.id))
        },
        {
          label: t('playlist.copyPlaylistId'),
          style: 'default' as const,
          onclick: () => copyText(String(pl.id), t('common.playlistId'))
        }
      ]
    });
  }

  function openAlbumSheet(al: any, artistName: string) {
    openSheet({
      title: al.name,
      subtitle: t('album.albumSubtitle', { artist: artistName || t('common.unknownArtist'), id: al.id }),
      actions: [
        {
          label: t('album.viewAlbumTracks'),
          style: 'primary' as const,
          onclick: () => onAlbum(String(al.id))
        },
        {
          label: t('album.copyAlbumId'),
          style: 'default' as const,
          onclick: () => copyText(String(al.id), t('common.albumId'))
        }
      ]
    });
  }

  function openArtistSheet(ar: any) {
    openSheet({
      title: ar.name,
      subtitle: t('artist.artistSubtitle', { id: ar.id }),
      actions: [
        {
          label: t('artist.viewTop50'),
          style: 'primary' as const,
          onclick: () => onViewArtist(String(ar.id))
        },
        {
          label: t('artist.copyArtistId'),
          style: 'default' as const,
          onclick: () => copyText(String(ar.id), t('common.artistId'))
        }
      ]
    });
  }
</script>

<ul class="data-list scrollable-list">
  {#if searchLoading}
    <li style="justify-content:center; color:var(--text-secondary); padding:20px 0; font-size:13px;">{t('search.searchingWait')}</li>
  {:else}
    {#each sResults as r, idx}
      {#if sType === '1'}
        {@const artistName = formatArtist(r.artists || r.ar || r.artist)}
        {@const status = getTrackSourceStatus(r.id, r.isLocal, curTrack)}
        {@const isPlayingThis = isSameTrack(curTrack, r)}
        {@const playLabel = getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'short' })}
        {@const coverUrl = r.picUrl || r.al?.picUrl || r.album?.picUrl || ''}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <!-- 左侧：封面（若有）+ 标题/副信息两行排版 -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            {#if coverUrl}
              <div class="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg overflow-hidden bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs">
                <img
                  src={formatCoverUrl(coverUrl, 120)}
                  alt={r.name}
                  class="w-full h-full object-cover"
                  loading="lazy"
                  onerror={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_VINYL_COVER; }}
                />
              </div>
            {/if}

            <div class="flex flex-col min-w-0 flex-1 justify-center py-0.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors text-xs sm:text-sm leading-snug"
                  onclick={() => onSong ? onSong(String(r.id)) : (onPlayQueue && onPlayQueue([toPlayerTrack(r, { artist: artistName, isLocal: status.isLocal })]))}
                >
                  <span class="text-[var(--text-muted)] font-mono mr-1 text-[11px]">{idx + 1}.</span>{r.name}
                </button>
                <TrackSourceBadge id={r.id} isLocal={r.isLocal} {curTrack} class="shrink-0" />
              </div>
              <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                {#if artistName}
                  <span class="text-[var(--text-secondary)] truncate">{artistName}</span>
                  <span class="opacity-40">·</span>
                {/if}
                <span class="font-mono opacity-80 shrink-0">ID:{r.id}</span>
              </div>
            </div>
          </div>

          <div class="track-action-group">
            <!-- 💻 PC 桌面端快捷操作 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              {#if onToggleLike}
                <TrackLikeBtn liked={likedSet.has(Number(r.id))} onclick={() => onToggleLike(Number(r.id), r.name, artistName)} />
              {/if}
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([toPlayerTrack(r, { artist: artistName, isLocal: status.isLocal })])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              {#if status.isServer}
                <SlotBtn onclick={() => onReveal && onReveal({ id: r.id, name: r.name, artist: artistName })}>{t('common.reveal')}</SlotBtn>
              {/if}
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(r.id))}>{t('common.detailShort')}</SlotBtn>
              {/if}
              <SlotBtn onclick={() => addToPlaylistSong = { id: r.id, name: r.name, artist: artistName }}>{t('playlist.collectShort')}</SlotBtn>
            </div>

            <!-- 📱 SP 移动端常用功能 + ··· 抽屉 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([toPlayerTrack(r, { artist: artistName, isLocal: status.isLocal })])}
                >
                  {playLabel}
                </SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openSearchTrackSheet(r, status.isLocal, artistName, isPlayingThis)}
                title={t('common.moreActions')}
                aria-label={t('common.moreActions')}
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {:else if sType === '10'}
        {@const albumArtist = formatArtist(r.artists || r.ar || (typeof r.artist === 'string' ? r.artist : (r.artist?.name || r.artist)))}
        <li class="track-item-card">
          <!-- 左侧：封面缩略图 + 标题与副信息 -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg overflow-hidden bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs">
              <img
                src={formatCoverUrl(r.picUrl, 120)}
                alt={r.name}
                class="w-full h-full object-cover"
                loading="lazy"
                onerror={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_VINYL_COVER; }}
              />
            </div>

            <div class="flex flex-col min-w-0 flex-1 justify-center py-0.5">
              <button
                type="button"
                class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors text-xs sm:text-sm leading-snug"
                onclick={() => onAlbum(String(r.id))}
                title={r.name}
              >
                <span class="text-[var(--text-muted)] font-mono mr-1 text-[11px]">{idx + 1}.</span>{r.name}
              </button>
              <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                {#if albumArtist}
                  <span class="text-[var(--text-secondary)] truncate">{albumArtist}</span>
                  <span class="opacity-40">·</span>
                {/if}
                {#if r.size}
                  <span>{t('search.songCount', { count: r.size })}</span>
                  <span class="opacity-40">·</span>
                {/if}
                <span class="font-mono opacity-80 shrink-0">ID:{r.id}</span>
              </div>
            </div>
          </div>

          <div class="track-action-group">
            <!-- 💻 PC 桌面端 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              <SlotBtn onclick={() => onAlbum(String(r.id))}>{t('album.viewDetails')}</SlotBtn>
            </div>

            <!-- 📱 SP 移动端 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              <SlotBtn onclick={() => onAlbum(String(r.id))}>{t('common.detailShort')}</SlotBtn>
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openAlbumSheet(r, albumArtist)}
                title={t('common.moreActions')}
                aria-label={t('common.moreActions')}
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {:else if sType === '1000'}
        <li class="track-item-card">
          <!-- 左侧：歌单封面缩略图 + 标题与副信息 -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg overflow-hidden bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs">
              <img
                src={formatCoverUrl(r.coverImgUrl, 120)}
                alt={r.name}
                class="w-full h-full object-cover"
                loading="lazy"
                onerror={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_VINYL_COVER; }}
              />
            </div>

            <div class="flex flex-col min-w-0 flex-1 justify-center py-0.5">
              <button
                type="button"
                class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors text-xs sm:text-sm leading-snug"
                onclick={() => onPlaylist(String(r.id))}
                title={r.name}
              >
                <span class="text-[var(--text-muted)] font-mono mr-1 text-[11px]">{idx + 1}.</span>{r.name}
              </button>
              <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                {#if r.trackCount !== undefined}
                  <span>{t('search.trackCountTotal', { count: r.trackCount })}</span>
                  <span class="opacity-40">·</span>
                {/if}
                {#if r.creator?.nickname}
                  <span class="truncate max-w-[100px]">{r.creator.nickname}</span>
                  <span class="opacity-40">·</span>
                {/if}
                <span class="font-mono opacity-80 shrink-0">ID:{r.id}</span>
              </div>
            </div>
          </div>

          <div class="track-action-group">
            <!-- 💻 PC 桌面端快捷操作 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              <SlotBtn onclick={() => handleDownloadPlaylist(String(r.id), r.name)} title={t('playlist.downloadAllSongs')}>{t('playlist.downloadAllShort')}</SlotBtn>
              {#if onPlayQueue}
                <SlotBtn onclick={() => handlePlayPlaylist(String(r.id), r.name)}>{t('search.play')}</SlotBtn>
              {/if}
              <SlotBtn onclick={() => onPlaylist(String(r.id))}>{t('common.viewDetails')}</SlotBtn>
            </div>

            <!-- 📱 SP 移动端快捷操作 (播放整单 + ··· 抽屉) -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn onclick={() => handlePlayPlaylist(String(r.id), r.name)} title={t('playlist.playAllLong')}>{t('search.play')}</SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openPlaylistSheet(r)}
                title={t('common.moreActions')}
                aria-label={t('common.moreActions')}
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {:else}
        <li class="track-item-card">
          <!-- 左侧：歌手圆形头像 + 标题与副信息 -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full overflow-hidden bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs">
              <img
                src={formatCoverUrl(r.picUrl || r.img1v1Url, 120)}
                alt={r.name}
                class="w-full h-full object-cover"
                loading="lazy"
                onerror={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_VINYL_COVER; }}
              />
            </div>

            <div class="flex flex-col min-w-0 flex-1 justify-center py-0.5">
              <button
                type="button"
                class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors text-xs sm:text-sm leading-snug"
                onclick={() => onViewArtist(String(r.id))}
                title={r.name}
              >
                <span class="text-[var(--text-muted)] font-mono mr-1 text-[11px]">{idx + 1}.</span>{r.name}
              </button>
              <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                <span class="font-mono opacity-80 shrink-0">ID:{r.id}</span>
              </div>
            </div>
          </div>

          <div class="track-action-group">
            <!-- 💻 PC 桌面端 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              <SlotBtn onclick={() => onViewArtist(String(r.id))}>{t('artist.hotTop50')}</SlotBtn>
            </div>

            <!-- 📱 SP 移动端 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              <SlotBtn onclick={() => onViewArtist(String(r.id))}>{t('artist.hotShort')}</SlotBtn>
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openArtistSheet(r)}
                title={t('common.moreActions')}
                aria-label={t('common.moreActions')}
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {/if}
    {:else}
      {#if hasSearched}
        <li style="justify-content:center; color:var(--text-muted); padding:24px 0; font-size:13px;">{t('search.noResults')}</li>
      {:else}
        <li style="justify-content:center; color:var(--text-muted); padding:24px 0; font-size:13px;">{t('search.enterKeywordPrompt')}</li>
      {/if}
    {/each}
  {/if}
</ul>

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}
