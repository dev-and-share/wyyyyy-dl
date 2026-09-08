<script lang="ts">
  import DesktopPlaylistGallery from './DesktopPlaylistGallery.svelte';
  import DesktopPlaylistDetail from './DesktopPlaylistDetail.svelte';
  import { playPlaylistTracks } from '../../lib/playerHelper';
  import { resetActiveTargetPlaylist } from '../../lib/playlist.svelte';
  import { exitPlaylistToGallery, jumpToPlaylist } from '../../lib/router.svelte';

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
    } else {
      // 路由无 ID 或退出详情时回到画廊
      selectedId = '';
      dismissed = true;
    }
  });

  let activePlaylistId = $derived(dismissed ? '' : (selectedId || playlistId || ''));

  function handleBackToGallery() {
    dismissed = true;
    selectedId = '';
    resetActiveTargetPlaylist();
    exitPlaylistToGallery();
  }

  function handleSelectPlaylist(id: string) {
    dismissed = false;
    selectedId = id;
    jumpToPlaylist(id);
  }

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
      onBackToGallery={handleBackToGallery}
      {onToggleLike}
      {onPlayQueue}
      {onAlbum}
      {onReveal}
      {showToast}
    />
  {:else}
    <DesktopPlaylistGallery
      onSelectPlaylist={handleSelectPlaylist}
      onPlayPlaylist={handlePlayPlaylistDirect}
      {showToast}
    />
  {/if}
</div>
