<script lang="ts">
  import DesktopPlaylistGallery from './DesktopPlaylistGallery.svelte';
  import DesktopPlaylistDetail from './DesktopPlaylistDetail.svelte';
  import { playPlaylistTracks } from '../../lib/playerHelper';

  let {
    playlistId = '',
    playlistTrigger = 0,
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
    playlistTrigger?: number;
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
  let lastSeenTrigger = $state(-1);

  $effect(() => {
    const curId = playlistId;
    const curTrig = playlistTrigger;
    if (curId) {
      if (curTrig !== lastSeenTrigger) {
        lastSeenTrigger = curTrig;
        dismissed = false;
        selectedId = curId;
      } else if (!dismissed && !selectedId) {
        selectedId = curId;
      }
    }
  });

  let activePlaylistId = $derived(dismissed ? '' : (selectedId || playlistId || ''));

  function handlePlayPlaylistDirect(id: string, name: string) {
    if (!id || !onPlayQueue) return;
    playPlaylistTracks(id, name, onPlayQueue, showToast);
  }
</script>

<div class="w-full flex flex-col gap-4 animate-fade-in" data-testid="desktop-playlist-view">
  {#if activePlaylistId}
    <DesktopPlaylistDetail
      playlistId={activePlaylistId}
      {playlistTrigger}
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
