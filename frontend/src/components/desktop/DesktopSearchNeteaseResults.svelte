<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER, formatCoverUrl } from '../../lib/utils';
  import SlotBtn from '../SlotBtn.svelte';
  import TrackLikeBtn from '../TrackLikeBtn.svelte';
  import TrackSourceBadge from '../TrackSourceBadge.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel, isSameTrack } from '../../lib/player/trackStatus.svelte';
  import { t } from '../../lib/i18n';

  let {
    results = [],
    sType = '1',
    curTrack = null,
    playing = false,
    likedSet = new Set<number>(),
    cachingTrackId = null,
    onToggleLike,
    onAlbum,
    onPlaylist,
    onPlayQueue,
    onSong,
    onReveal,
    onDownloadTrack,
    onDownloadAlbum,
    onDownloadPlaylist,
    onCacheTrack,
    onOpenAddToPlaylist,
    onSelectArtist,
    onSearchSongsForArtist
  } = $props<{
    results: any[];
    sType: string;
    curTrack?: any;
    playing?: boolean;
    likedSet?: Set<number>;
    cachingTrackId?: number | null;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onAlbum?: (id: string, name?: string) => void;
    onPlaylist: (id: string) => void;
    onPlayQueue?: (tracks: any[], idx?: any) => void;
    onSong?: (id: string) => void;
    onReveal?: (item: any) => void;
    onDownloadTrack: (id: string, name?: string) => void;
    onDownloadAlbum: (id: string, name: string) => void;
    onDownloadPlaylist: (id: string, name: string) => void;
    onCacheTrack: (item: any) => void;
    onOpenAddToPlaylist: (item: any) => void;
    onSelectArtist: (id: string) => void;
    onSearchSongsForArtist: (name: string) => void;
  }>();
</script>

{#if sType === '1'}
  <!-- 单曲全宽大表 -->
  <div class="rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] overflow-hidden shadow-sm">
    <div class="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-muted)]">
      <span>{t('search.searchedSongCount', { count: results.length })}</span>
      <span>{t('search.clickToPlayOrDownload')}</span>
    </div>
    <div class="overflow-x-auto max-h-[620px] overflow-y-auto custom-table-scroll">
      <table class="w-full text-left border-collapse text-xs">
        <thead class="sticky top-0 z-10 bg-[var(--card-header-bg)] backdrop-blur-xl border-b border-[var(--border-color)] text-[var(--text-muted)]">
          <tr>
            <th class="w-12 py-3 pl-4 font-semibold">#</th>
            <th class="py-3 px-3 font-semibold">{t('search.tableTitle')}</th>
            <th class="py-3 px-3 font-semibold w-40">{t('common.artist')}</th>
            <th class="py-3 px-3 font-semibold w-44 hidden md:table-cell">{t('common.album')}</th>
            <th class="py-3 pr-4 text-right font-semibold w-56">{t('search.tableActions')}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-subtle)]">
          {#each results as r, idx (r.id)}
            {@const artistName = formatArtist(r)}
            {@const status = getTrackSourceStatus(r.id, r.isLocal, curTrack)}
            {@const isPlayingThis = isSameTrack(curTrack, r)}
            <tr class="hover:bg-[var(--card-header-hover)] transition-colors group {isPlayingThis ? 'bg-red-500/10' : ''}">
              <td class="py-2.5 pl-4 text-[var(--text-muted)] font-mono text-[11px]">
                {#if isPlayingThis && playing}
                  <span class="text-red-500 animate-pulse">▶</span>
                {:else}
                  {idx + 1}
                {/if}
              </td>
              <td class="py-2.5 px-3 min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    class="font-semibold text-[var(--text-main)] truncate max-w-xs xl:max-w-md group-hover:text-red-400 transition-colors bg-transparent border-none p-0 cursor-pointer text-left"
                    onclick={() => onSong ? onSong(String(r.id)) : (onPlayQueue && onPlayQueue([{ id: r.id, name: r.name, artist: artistName, cover: r.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }]))}
                  >
                    {r.name}
                  </button>
                  <TrackSourceBadge id={r.id} isLocal={r.isLocal} {curTrack} class="shrink-0" />
                  {#if onToggleLike}
                    <TrackLikeBtn liked={likedSet.has(Number(r.id))} onclick={() => onToggleLike(Number(r.id), r.name, artistName)} />
                  {/if}
                </div>
              </td>
              <td class="py-2.5 px-3 text-[var(--text-secondary)] truncate">
                {artistName || t('common.variousArtists')}
              </td>
              <td class="py-2.5 px-3 text-[var(--text-muted)] truncate hidden md:table-cell">
                {#if r.al?.id && onAlbum}
                  <button
                    type="button"
                    class="text-left bg-transparent border-none p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer truncate max-w-[160px]"
                    onclick={() => onAlbum(String(r.al.id), r.al?.name)}
                  >
                    {r.al.name || t('search.tab.song')}
                  </button>
                {:else}
                  <span>{r.al?.name || r.album?.name || t('search.tab.song')}</span>
                {/if}
              </td>
              <td class="py-2.5 pr-4 text-right whitespace-nowrap">
                <div class="inline-flex items-center justify-end gap-1.5">
                  <SlotBtn
                    playing={isPlayingThis && playing}
                    onclick={() => onPlayQueue && onPlayQueue([{ id: r.id, name: r.name, artist: artistName, cover: r.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                  >
                    {getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'desktop' })}
                  </SlotBtn>
                  {#if status.isServer}
                    <SlotBtn onclick={() => onReveal && onReveal({ id: r.id, name: r.name, artist: artistName })}>{t('common.reveal')}</SlotBtn>
                  {:else}
                    <SlotBtn onclick={() => onDownloadTrack(String(r.id), r.name)}>{t('download.downloadSingle')}</SlotBtn>
                  {/if}
                  <SlotBtn onclick={() => onCacheTrack(r)}>
                    {status.isPhone ? t('search.cachedShort') : cachingTrackId === r.id ? '⏳' : t('search.cacheShort')}
                  </SlotBtn>
                  <SlotBtn onclick={() => onOpenAddToPlaylist({ id: r.id, name: r.name, artist: artistName })}>➕</SlotBtn>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{:else if sType === '10'}
  <!-- 专辑网格直铺 -->
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
    {#each results as al (al.id)}
      <div class="group flex flex-col gap-2 p-3 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1">
        <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
          <img src={formatCoverUrl(al.picUrl, 250)} alt={al.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        </div>
        <span class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-red-400 transition-colors" title={al.name}>{al.name}</span>
        <span class="text-[11px] text-[var(--text-secondary)] truncate">{formatArtist(al.artists || al.artist) || t('common.variousArtists')}</span>
        <div class="flex items-center gap-1.5 pt-1">
          {#if onAlbum}
            <button type="button" class="btn-primary flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => onAlbum(String(al.id), al.name)}>{t('album.viewShort')}</button>
          {/if}
          <button type="button" class="btn-secondary py-1 px-2 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => onDownloadAlbum(String(al.id), al.name)} title={t('album.downloadFull')}>📥</button>
        </div>
      </div>
    {/each}
  </div>
{:else if sType === '1000'}
  <!-- 歌单网格直铺 -->
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
    {#each results as pl (pl.id)}
      <div class="group flex flex-col gap-2 p-3 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1">
        <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-black/20">
          <img src={formatCoverUrl(pl.coverImgUrl, 250)} alt={pl.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        </div>
        <span class="font-semibold text-xs text-[var(--text-main)] truncate group-hover:text-red-400 transition-colors" title={pl.name}>{pl.name}</span>
        <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>{t('playlist.trackCount', { count: pl.trackCount || 0 })}</span>
          <span class="truncate max-w-[90px]">{pl.creator?.nickname || ''}</span>
        </div>
        <div class="flex items-center gap-1.5 pt-1">
          <button type="button" class="btn-primary flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => onPlaylist(String(pl.id))}>{t('playlist.viewShort')}</button>
          <button type="button" class="btn-secondary py-1 px-2 rounded-lg text-[11px] font-semibold cursor-pointer" onclick={() => onDownloadPlaylist(String(pl.id), pl.name)} title={t('playlist.downloadAllShort')}>📥</button>
        </div>
      </div>
    {/each}
  </div>
{:else if sType === '100'}
  <!-- 歌手圆形头像网格直铺 -->
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
    {#each results as ar (ar.id)}
      <div class="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--card-header-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-1 text-center">
        <button
          type="button"
          class="w-20 h-20 rounded-full overflow-hidden bg-black/20 shadow-md border-none p-0 cursor-pointer group-hover:ring-2 ring-red-500/50 transition-all"
          onclick={() => onSelectArtist(String(ar.id))}
          title={t('artist.clickToViewTop50WithName', { name: ar.name })}
        >
          <img src={formatCoverUrl(ar.picUrl || ar.img1v1Url, 250)} alt={ar.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        </button>
        <button
          type="button"
          class="font-bold text-xs text-[var(--text-main)] truncate max-w-full group-hover:text-red-400 transition-colors bg-transparent border-none p-0 cursor-pointer flex items-center gap-1"
          onclick={() => onSelectArtist(String(ar.id))}
          title={t('artist.clickToViewTop50')}
        >
          <span>{ar.name}</span>
          <span class="text-[11px] text-[var(--text-muted)] font-normal font-mono">(ID: {ar.id})</span>
        </button>
        <span class="text-[11px] text-[var(--text-muted)]">{t('artist.albumCount', { count: ar.albumSize || 0 })} · {t('artist.songCount', { count: ar.musicSize || 0 })}</span>
        <div class="flex items-center gap-1.5 w-full pt-1">
          <button
            type="button"
            data-testid="btn-artist-view-top50"
            class="btn-primary flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
            onclick={() => onSelectArtist(String(ar.id))}
            title={t('artist.viewTop50Desc')}
          >
            {t('artist.hotTop50')}
          </button>
          <button
            type="button"
            class="btn-secondary py-1 px-2 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
            onclick={() => onSearchSongsForArtist(ar.name)}
            title={t('artist.searchSongsDesc')}
          >
            {t('artist.searchSongs')}
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
