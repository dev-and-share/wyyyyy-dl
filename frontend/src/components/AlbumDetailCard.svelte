<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { getTrackSourceStatus } from '../lib/trackStatus.svelte';

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

  function openTrackSheet(s: any, isLocal: boolean, artistName: string, isPlayingThis: boolean) {
    openSheet({
      title: s.name,
      subtitle: artistName || '未知歌手',
      actions: [
        ...(onPlayQueue
          ? [
              {
                label: isPlayingThis && playing ? '⏸ 暂停当前播放' : (isLocal ? '▶️ 播放本地音频' : '▶️ 试听在线歌曲'),
                style: 'primary' as const,
                onclick: () =>
                  onPlayQueue([
                    {
                      id: s.id,
                      name: s.name,
                      artist: artistName,
                      cover: album?.coverImgUrl || album?.picUrl || DEFAULT_VINYL_COVER,
                      isLocal
                    }
                  ])
              }
            ]
          : []),
        ...(isLocal && onReveal
          ? [
              {
                label: '📂 在服务器磁盘中定位',
                style: 'default' as const,
                onclick: () => onReveal({ id: s.id, name: s.name, artist: artistName })
              }
            ]
          : [
              {
                label: '📥 下载到电脑服务器',
                style: 'default' as const,
                onclick: () => onDownloadSingleTrack(String(s.id))
              }
            ]),
        ...(onSong
          ? [
              {
                label: '🎧 查看单曲详情',
                style: 'default' as const,
                onclick: () => onSong(String(s.id))
              }
            ]
          : []),
        ...(onToggleLike
          ? [
              {
                label: likedSet.has(Number(s.id)) ? '💔 取消喜欢' : '❤️ 收藏到我的喜欢',
                style: 'default' as const,
                onclick: () => onToggleLike(Number(s.id), s.name, artistName)
              }
            ]
          : [])
      ]
    });
  }
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
        {@const status = getTrackSourceStatus(s.id, s.isLocal, curTrack)}
        {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(s.id) || (curTrack.name && curTrack.name === s.name)))}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <button
              type="button"
              class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
              onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }]))}
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
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {isPlayingThis && playing ? '⏸ 播放中' : (status.isLocal ? '▶️ 播放' : '▶️ 试听')}
                </SlotBtn>
              {/if}
              {#if status.isServer}
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

            <!-- 📱 SP 移动端常用功能 + ··· 抽屉 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: album.coverImgUrl || album.picUrl || DEFAULT_VINYL_COVER, isLocal: status.isLocal }])}
                >
                  {isPlayingThis && playing ? '⏸ 播放中' : (status.isLocal ? '▶️ 播放' : '▶️ 试听')}
                </SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openTrackSheet(s, status.isLocal, artistName, isPlayingThis)}
                title="更多操作"
                aria-label="更多操作"
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
      <div class="empty-title">在搜索中选择专辑或输入 ID 解析</div>
    </div>
  {/if}
</AccordionCard>
