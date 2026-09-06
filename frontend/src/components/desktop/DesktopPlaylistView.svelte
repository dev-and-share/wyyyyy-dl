<script lang="ts">
  import DesktopPlaylistGallery from './DesktopPlaylistGallery.svelte';
  import DesktopPlaylistDetail from './DesktopPlaylistDetail.svelte';
  import { api } from '../../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { getTrackSourceStatus } from '../../lib/trackStatus.svelte';
  import { recordPlaylistPlay } from '../../lib/playlist.svelte';

  let {
    playlistId = '',
    curTrack = null,
    playing = false,
    likedSet,
    downloadedSet = new Set<number>(),
    onToggleLike,
    onPlayQueue,
    onAlbum,
    onReveal,
    showToast
  } = $props<{
    playlistId?: string;
    curTrack?: any;
    playing?: boolean;
    likedSet: Set<number>;
    downloadedSet?: Set<number>;
    onToggleLike: (id: number, name: string) => void;
    onPlayQueue: (tracks: any[], idx?: number) => void;
    onAlbum?: (albumId: string) => void;
    onReveal?: (item: any) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let selectedId = $state('');
  let dismissed = $state(false);

  $effect(() => {
    if (playlistId) {
      dismissed = false;
    }
  });

  let activePlaylistId = $derived(dismissed ? '' : (selectedId || playlistId || ''));

  async function handlePlayPlaylistDirect(id: string, name: string) {
    if (!id) return;
    try {
      showToast(`正在载入《${name}》...`, 'info', 1500);
      const res = await api.playlist(id);
      const tracks = res?.data?.playlist?.tracks || res?.data?.tracks || [];
      if (tracks && tracks.length > 0) {
        const queueTracks = tracks.map((t: any) => ({
          id: t.id,
          name: t.name,
          artist: formatArtist(t.artists || t.ar || t.artist),
          cover: t.picUrl || t.al?.picUrl || DEFAULT_VINYL_COVER,
          isLocal: getTrackSourceStatus(t.id, t.isLocal, curTrack).isLocal
        }));
        if (onPlayQueue) {
          recordPlaylistPlay(id);
          onPlayQueue(queueTracks, 0);
          showToast(`已开始播放歌单《${name}》(${queueTracks.length} 首)`, 'success', 2000);
        }
      } else {
        showToast('歌单内暂无曲目', 'warning');
      }
    } catch (e: any) {
      showToast('播放歌单失败: ' + (e?.message || e), 'error');
    }
  }
</script>

<div class="w-full flex flex-col gap-4 animate-fade-in" data-testid="desktop-playlist-view">
  {#if activePlaylistId}
    <DesktopPlaylistDetail
      playlistId={activePlaylistId}
      {curTrack}
      {playing}
      {likedSet}
      {downloadedSet}
      onBackToGallery={() => { dismissed = true; selectedId = ''; }}
      {onToggleLike}
      {onPlayQueue}
      {onAlbum}
      {onReveal}
      {showToast}
    />
  {:else}
    <DesktopPlaylistGallery
      onSelectPlaylist={(id) => { dismissed = false; selectedId = id; }}
      onPlayPlaylist={handlePlayPlaylistDirect}
      {showToast}
    />
  {/if}
</div>
