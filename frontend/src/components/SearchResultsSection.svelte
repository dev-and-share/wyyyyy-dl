<script lang="ts">
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { toPlayerTrack } from '../lib/playerHelper';
  import type { Track } from '../lib/types';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import TrackSourceBadge from './TrackSourceBadge.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel } from '../lib/trackStatus.svelte';

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

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`已复制${label}: ${text}`, 'success');
    } catch {
      showToast(`复制失败: ${text}`, 'warning');
    }
  }

  function openSearchTrackSheet(r: any, isLocal: boolean, artistName: string, isPlayingThis: boolean) {
    openSheet({
      title: r.name,
      subtitle: artistName || '未知歌手',
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
                label: '📂 在服务器磁盘中定位',
                style: 'default' as const,
                onclick: () => onReveal({ id: r.id, name: r.name, artist: artistName })
              }
            ]
          : []),
        ...(onSong
          ? [
              {
                label: '🎧 查看单曲详情 / 下载',
                style: 'default' as const,
                onclick: () => onSong(String(r.id))
              }
            ]
          : []),
        ...(onToggleLike
          ? [
              {
                label: likedSet.has(Number(r.id)) ? '💔 取消喜欢' : '❤️ 收藏到我的喜欢',
                style: 'default' as const,
                onclick: () => onToggleLike(Number(r.id), r.name, artistName)
              }
            ]
          : []),
        {
          label: '📋 复制歌曲 ID',
          style: 'default' as const,
          onclick: () => copyText(String(r.id), '歌曲 ID')
        }
      ]
    });
  }

  function openPlaylistSheet(pl: any) {
    openSheet({
      title: pl.name,
      subtitle: `歌单 · 共 ${pl.trackCount || 0} 首 · ID: ${pl.id}`,
      actions: [
        ...(onPlayQueue
          ? [
              {
                label: '▶️ 立即播放整单',
                style: 'primary' as const,
                onclick: () => handlePlayPlaylist(String(pl.id), pl.name)
              }
            ]
          : []),
        {
          label: '📥 下载整单全部歌曲',
          style: 'default' as const,
          onclick: () => handleDownloadPlaylist(String(pl.id), pl.name)
        },
        {
          label: '👉 查看歌单详情与曲目',
          style: 'default' as const,
          onclick: () => onPlaylist(String(pl.id))
        },
        {
          label: '📋 复制歌单 ID',
          style: 'default' as const,
          onclick: () => copyText(String(pl.id), '歌单 ID')
        }
      ]
    });
  }

  function openAlbumSheet(al: any, artistName: string) {
    openSheet({
      title: al.name,
      subtitle: `专辑 · ${artistName || '未知歌手'} · ID: ${al.id}`,
      actions: [
        {
          label: '👉 查看专辑详情与曲目',
          style: 'primary' as const,
          onclick: () => onAlbum(String(al.id))
        },
        {
          label: '📋 复制专辑 ID',
          style: 'default' as const,
          onclick: () => copyText(String(al.id), '专辑 ID')
        }
      ]
    });
  }

  function openArtistSheet(ar: any) {
    openSheet({
      title: ar.name,
      subtitle: `歌手 · ID: ${ar.id}`,
      actions: [
        {
          label: '🔥 查看热门 50 首',
          style: 'primary' as const,
          onclick: () => onViewArtist(String(ar.id))
        },
        {
          label: '📋 复制歌手 ID',
          style: 'default' as const,
          onclick: () => copyText(String(ar.id), '歌手 ID')
        }
      ]
    });
  }
</script>

<ul class="data-list scrollable-list">
  {#if searchLoading}
    <li style="justify-content:center; color:var(--text-secondary); padding:20px 0; font-size:13px;">🔄 正在检索，请稍候...</li>
  {:else}
    {#each sResults as r, idx}
      {#if sType === '1'}
        {@const artistName = formatArtist(r.artists || r.ar || r.artist)}
        {@const status = getTrackSourceStatus(r.id, r.isLocal, curTrack)}
        {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(r.id) || (curTrack.name && curTrack.name === r.name)))}
        {@const playLabel = getTrackPlayActionLabel({ isPlaying: isPlayingThis && playing, isLocal: status.isLocal, variant: 'short' })}
        {@const coverUrl = r.picUrl || r.al?.picUrl || r.album?.picUrl || ''}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <!-- 左侧：封面（若有）+ 标题/副信息两行排版 -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            {#if coverUrl}
              <div class="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg overflow-hidden bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-xs">
                <img
                  src={coverUrl}
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
                <SlotBtn onclick={() => onReveal && onReveal({ id: r.id, name: r.name, artist: artistName })}>📂 定位</SlotBtn>
              {/if}
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(r.id))}>👉 详情</SlotBtn>
              {/if}
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
                title="更多操作"
                aria-label="更多操作"
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
                src={r.picUrl || DEFAULT_VINYL_COVER}
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
                  <span>{r.size} 首歌</span>
                  <span class="opacity-40">·</span>
                {/if}
                <span class="font-mono opacity-80 shrink-0">ID:{r.id}</span>
              </div>
            </div>
          </div>

          <div class="track-action-group">
            <!-- 💻 PC 桌面端 -->
            <div class="hidden md:inline-flex items-center gap-1.5">
              <SlotBtn onclick={() => onAlbum(String(r.id))}>👉 查看专辑详情</SlotBtn>
            </div>

            <!-- 📱 SP 移动端 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              <SlotBtn onclick={() => onAlbum(String(r.id))}>👉 详情</SlotBtn>
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openAlbumSheet(r, albumArtist)}
                title="更多操作"
                aria-label="更多操作"
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
                src={r.coverImgUrl || DEFAULT_VINYL_COVER}
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
                  <span>共 {r.trackCount} 首</span>
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
              <SlotBtn onclick={() => handleDownloadPlaylist(String(r.id), r.name)} title="立即下载整张歌单全部歌曲">📥 下载整单</SlotBtn>
              {#if onPlayQueue}
                <SlotBtn onclick={() => handlePlayPlaylist(String(r.id), r.name)}>▶ 播放</SlotBtn>
              {/if}
              <SlotBtn onclick={() => onPlaylist(String(r.id))}>👉 查看详情</SlotBtn>
            </div>

            <!-- 📱 SP 移动端快捷操作 (播放整单 + ··· 抽屉) -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn onclick={() => handlePlayPlaylist(String(r.id), r.name)} title="播放整单">▶ 播放</SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openPlaylistSheet(r)}
                title="更多操作"
                aria-label="更多操作"
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
                src={r.picUrl || r.img1v1Url || DEFAULT_VINYL_COVER}
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
              <SlotBtn onclick={() => onViewArtist(String(r.id))}>👉 热门 50 首</SlotBtn>
            </div>

            <!-- 📱 SP 移动端 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              <SlotBtn onclick={() => onViewArtist(String(r.id))}>🔥 热门</SlotBtn>
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openArtistSheet(r)}
                title="更多操作"
                aria-label="更多操作"
              >
                ···
              </button>
            </div>
          </div>
        </li>
      {/if}
    {:else}
      {#if hasSearched}
        <li style="justify-content:center; color:var(--text-muted); padding:24px 0; font-size:13px;">未搜索到相关结果</li>
      {:else}
        <li style="justify-content:center; color:var(--text-muted); padding:24px 0; font-size:13px;">输入关键词后按回车搜索</li>
      {/if}
    {/each}
  {/if}
</ul>
