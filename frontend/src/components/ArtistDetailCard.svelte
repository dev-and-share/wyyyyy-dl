<script lang="ts">
  import { onMount } from 'svelte';
  import { formatArtist, DEFAULT_VINYL_COVER, getApiCache, setApiCache } from '../lib/utils';
  import AccordionCard from './AccordionCard.svelte';
  import DetailHeaderCard from './DetailHeaderCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import TrackLikeBtn from './TrackLikeBtn.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { cachedSongIdSet, cacheTrackToBrowser } from '../lib/pwaCache.svelte';
  import { api } from '../lib/api';

  let {
    artist = null,
    artistLoading = false,
    open = $bindable(false),
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
      showToast('请输入歌手 ID', 'warning');
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
        showToast(res.msg || '获取歌手信息失败', 'warning');
        return;
      }
      innerArtist = res?.data?.artist || res?.data || res;
      setApiCache('artist_' + targetId, res.data);
    } catch (e: any) {
      innerLoading = false;
      showToast('获取歌手失败: ' + (e.message || e), 'error');
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
      const isServer = downloadedSet && downloadedSet.has(Number(s.id));
      const isPhone = cachedSongIdSet.has(Number(s.id));
      return {
        id: s.id,
        name: s.name,
        artist: art,
        cover: s.picUrl || s.al?.picUrl || displayArtist?.coverImgUrl || DEFAULT_VINYL_COVER,
        isLocal: isServer || isPhone || s.isLocal === true
      };
    });
    onPlayQueue(q, 0);
    showToast(`已开始播放《${displayArtist.name}》热门曲目 (共 ${q.length} 首)`, 'success');
  }

  async function forkTopSongsToPlaylist() {
    const songs = displayArtist?.songs || [];
    if (!songs.length) {
      showToast('当前歌手无曲目可收藏', 'warning');
      return;
    }
    const plName = `《${displayArtist.name || '歌手'}》热门 ${songs.length} 首`;
    const trackIds = songs.map((s: any) => s.id).join(',');
    forking = true;
    try {
      const res = await api.playlistFork(plName, false, trackIds);
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || '收藏为歌单失败', 'error');
        return;
      }
      showToast(`已成功将 50 首热门曲目收藏为新歌单：${plName}`, 'success', 3500);
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));
    } catch (e: any) {
      showToast('收藏为歌单失败: ' + (e.message || e), 'error');
    } finally {
      forking = false;
    }
  }

  async function cacheAllTopSongs() {
    const songs = displayArtist?.songs || [];
    if (!songs.length) return;
    cachingBatch = true;
    showToast(`开始批量缓存《${displayArtist.name}》热门曲目...`, 'info', 2000);
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
    showToast(`批量缓存完成：成功缓存 ${successCount}/${songs.length} 首`, 'success');
  }

  function openTrackSheet(s: any, isLocal: boolean, isPhone: boolean, isServer: boolean, artistName: string, isPlayingThis: boolean) {
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
                label: '📂 在服务器磁盘中定位',
                style: 'default' as const,
                onclick: () => onReveal({ id: s.id, name: s.name, artist: artistName })
              }
            ]
          : [
              {
                label: '📥 下载到电脑服务器',
                style: 'default' as const,
                onclick: () => {
                  api.downloadSingle(String(s.id)).then(() => {
                    showToast(`已提交《${s.name}》下载任务`, 'info');
                    window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
                  }).catch((e: any) => showToast('下载提交失败: ' + e, 'error'));
                }
              }
            ]),
        {
          label: isPhone ? '📲 重新离线缓存 (手机已存)' : '📲 离线缓存到本手机 (PWA)',
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

<AccordionCard title="🎤 3. 歌手解析与热门 50 首" bind:open>
  <div class="flex items-center gap-1.5 md:gap-2.5 my-2.5 w-full">
    <input
      type="text"
      placeholder="输入歌手 ID (如 3061，按回车解析)"
      class="flex-1 min-w-0"
      bind:value={currentArtistId}
      onkeydown={(e) => e.key === 'Enter' && handleLoad()}
    />
    <button class="btn-primary shrink-0 whitespace-nowrap" onclick={() => handleLoad()}>
      解析<span class="hidden sm:inline">歌手</span>
    </button>
  </div>

  {#if displayLoading}
    <div style="padding:24px; text-align:center; color:var(--text-secondary); font-size:14px;">
      🔄 正在解析歌手热门 50 首曲目，请稍候...
    </div>
  {:else if displayArtist}
    <DetailHeaderCard
      cover={displayArtist.coverImgUrl || DEFAULT_VINYL_COVER}
      title={displayArtist.name || '未知歌手'}
      subtitle={`单曲：${displayArtist.musicSize || 0} 首 | 专辑：${displayArtist.albumSize || 0} 张`}
      subDetail={`🔥 热门 Top ${displayArtist.songs?.length || 0} 首曲目`}
    >
      <button class="btn-primary" onclick={playAllArtistTopSongs}>▶️ 连播热门</button>
      <button class="btn-secondary !text-blue-500 !border-blue-500/30 font-semibold" onclick={forkTopSongsToPlaylist} disabled={forking}>
        {forking ? '⏳ 正在转存...' : '📁 收藏为歌单'}
      </button>
      <button class="btn-secondary hidden sm:inline-flex" onclick={cacheAllTopSongs} disabled={cachingBatch}>
        {cachingBatch ? '⏳ 缓存中...' : '📲 缓存全榜'}
      </button>
    </DetailHeaderCard>

    {#if displayArtist.briefDesc}
      <div class="my-2 p-2.5 rounded-lg bg-black/5 dark:bg-white/[0.04] text-xs text-[var(--text-secondary)] leading-relaxed max-h-24 overflow-y-auto">
        {displayArtist.briefDesc}
      </div>
    {/if}

    <h4 style="margin:15px 0 8px 0; color:var(--text-main); font-size:15px; font-weight:600;">
      🔥 热门 50 首曲目列表 ({displayArtist.songs ? displayArtist.songs.length : 0} 首)：
    </h4>
    <ul class="data-list scrollable-list">
      {#each (displayArtist.songs || []) as s, i}
        {@const artistName = formatArtist(s.artist || s.ar || s.artists || displayArtist.name || '')}
        {@const isServer = (downloadedSet && downloadedSet.has(Number(s.id)))}
        {@const isPhone = cachedSongIdSet.has(Number(s.id))}
        {@const isLocal = isServer || isPhone || s.isLocal === true}
        {@const isPlayingThis = !!(curTrack && (String(curTrack.id) === String(s.id) || (curTrack.name && curTrack.name === s.name)))}
        <li class="track-item-card" class:is-active-playing={isPlayingThis}>
          <div class="track-title-row">
            <button
              type="button"
              class="clickable-track-title cursor-pointer truncate font-bold text-left bg-transparent border-none p-0 text-[var(--text-main)] hover:text-red-500 transition-colors"
              onclick={() => onSong ? onSong(String(s.id)) : (onPlayQueue && onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER, isLocal }]))}
            >
              {i + 1}. {s.name}
            </button>
            {#if artistName}<span class="text-xs text-[var(--text-secondary)] truncate"> - {artistName}</span>{/if}
            {#if isServer && isPhone}
              <span class="audio-source-badge icon-only badge-both ml-1.5" title="✨ 服务器与本机手机均已下载/缓存">✨</span>
            {:else if isServer}
              <span class="audio-source-badge icon-only badge-server ml-1.5" title="🖥️ 已下载到本地">🖥️</span>
            {:else if isPhone}
              <span class="audio-source-badge icon-only badge-browser ml-1.5" title="📲 已缓存到手机本地，断网可离线秒播">📲</span>
            {/if}
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
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER, isLocal }])}
                >
                  {isPlayingThis && playing ? '⏸ 播放中' : (isLocal ? '▶️ 播放' : '▶️ 试听')}
                </SlotBtn>
              {/if}
              {#if isServer}
                <SlotBtn onclick={() => onReveal && onReveal({ id: s.id, name: s.name, artist: artistName })}>📂 定位</SlotBtn>
              {:else}
                <SlotBtn onclick={() => {
                  api.downloadSingle(String(s.id)).then(() => {
                    showToast(`已提交《${s.name}》下载任务`, 'info');
                    window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
                  }).catch((e: any) => showToast('下载提交失败: ' + e, 'error'));
                }}>📥 下载</SlotBtn>
              {/if}
              <SlotBtn onclick={() => {
                cacheTrackToBrowser({
                  id: s.id,
                  name: s.name,
                  artist: artistName,
                  cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER,
                  album: s.album || s.al?.name || ''
                }).then(r => showToast(r.msg, r.success ? 'success' : 'warning'));
              }}>{isPhone ? '✅ 已缓存' : '📲 缓存'}</SlotBtn>
              {#if onSong}
                <SlotBtn onclick={() => onSong(String(s.id))}>👉 详情</SlotBtn>
              {/if}
            </div>

            <!-- 📱 SP 移动端常用功能 + ··· 抽屉 -->
            <div class="inline-flex md:hidden items-center gap-1.5">
              {#if onPlayQueue}
                <SlotBtn
                  playing={isPlayingThis && playing}
                  onclick={() => onPlayQueue([{ id: s.id, name: s.name, artist: artistName, cover: s.picUrl || s.al?.picUrl || displayArtist.coverImgUrl || DEFAULT_VINYL_COVER, isLocal }])}
                >
                  {isPlayingThis && playing ? '⏸ 播放中' : (isLocal ? '▶️ 播放' : '▶️ 试听')}
                </SlotBtn>
              {/if}
              <button
                type="button"
                class="btn-more-actions"
                onclick={() => openTrackSheet(s, isLocal, isPhone, isServer, artistName, isPlayingThis)}
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
  {/if}
</AccordionCard>
