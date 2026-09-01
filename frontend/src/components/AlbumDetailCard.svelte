<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';

  let {
    album,
    albumLoading = false,
    open = $bindable(false),
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
</script>

<AccordionCard title="💽 2. 专辑解析与整辑下载" bind:open>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input
      type="text"
      placeholder="输入专辑 ID (如 258535483，按回车解析)"
      class="flex-1 min-w-0"
      bind:value={currentAlbumId}
      onkeydown={(e) => e.key === 'Enter' && onLoadAlbum()}
    />
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => onLoadAlbum()}>
      解析<span class="hidden sm:inline">专辑</span>
    </button>
  </div>

  {#if albumLoading}
    <div style="padding:24px; text-align:center; color:var(--text-secondary); font-size:14px;">
      🔄 正在解析专辑数据，请稍候...
    </div>
  {:else if album}
    {@const headerArtist = formatArtist(album.artist || album.artists) || '未知歌手'}
    <DetailHeaderCard
      cover={album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER}
      title={album.name || '未知专辑'}
      subtitle={`歌手：${headerArtist} | 发行时间：${album.publishTime || '-'}`}
      subDetail={`共包含 ${album.songs?.length || 0} 首曲目`}
    >
      <button class="btn-primary" onclick={onDownloadFullAlbum}>🖥️ 下载到电脑</button>
      <button class="btn-secondary" onclick={onPlayFullAlbum}>▶️ 播放专辑</button>
    </DetailHeaderCard>

    <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">
      专辑曲目列表 ({album.songs ? album.songs.length : 0} 首)：
    </h4>
    <ul class="data-list scrollable-list">
      {#each (album.songs || []) as s, i}
        {@const artistName = formatArtist(s.artist || s.ar || s.artists || album.artist || '')}
        {@const isLocal = (downloadedSet && downloadedSet.has(Number(s.id))) || s.isLocal === true}
        {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(s.id) || (curTrack.name && curTrack.name === s.name)))}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <button
              type="button"
              class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
              onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER, isLocal }]))}
            >
              {i + 1}. {s.name}
            </button>
            {#if artistName}<span class="text-xs text-[var(--text-secondary)] truncate"> - {artistName}</span>{/if}
            {#if isLocal}<span class="audio-source-badge icon-only badge-server ml-1.5" title="🖥️ 已下载到本地">🖥️</span>{/if}
          </div>
          <div class="track-action-group">
            {#if onToggleLike}
              <TrackLikeBtn liked={likedSet.has(Number(s.id))} onclick={() => onToggleLike(Number(s.id), s.name, artistName)} />
            {/if}
            {#if onPlayQueue}
              <SlotBtn
                playing={isPlayingThis && playing}
                onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER, isLocal }])}
              >
                {isPlayingThis && playing ? '⏸ 播放中' : (isLocal ? '▶️ 播放' : '▶️ 试听')}
              </SlotBtn>
            {/if}
            {#if isLocal}
              <SlotBtn
                onclick={() => onReveal && onReveal({ id: s.id, name: s.name, artist: artistName })}
                title="在文件管理器中定位"
              >
                📂 定位
              </SlotBtn>
            {:else}
              <SlotBtn onclick={() => onDownloadSingleTrack(String(s.id))}>
                📥 下载
              </SlotBtn>
            {/if}
            {#if onSong}
              <SlotBtn onclick={() => onSong(String(s.id))}>🎧 详情</SlotBtn>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty-placeholder-card">
      <div class="empty-icon">💽</div>
      <div class="empty-title">在搜索中选择专辑或输入 ID 解析</div>
    </div>
  {/if}
</AccordionCard>
