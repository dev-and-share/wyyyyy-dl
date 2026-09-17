<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { playerStore } from '../lib/playerStore.svelte';
  import { getTrackSourceStatus, getTrackPlayActionLabel } from '../lib/trackStatus.svelte';
  import { toPlayerTrack } from '../lib/playerHelper';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';

  let {
    songId,
    likedSet = new Set<number>(),
    onToggleLike,
    onPlayQueue,
    onAlbum,
    onClose,
    showToast
  } = $props<{
    songId: string;
    likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onAlbum?: (albumId: string) => void;
    onClose: () => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let songLevel = $state('lossless');
  let songInfo = $state<any>(null);
  let loading = $state(true);
  let downloading = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);

  // 移动端底部滑动手势状态
  let closing = $state(false);
  let dragOffset = $state(0);
  let isDragging = $state(false);
  let startY = 0;

  function handleClose() {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      closing = false;
      onClose();
    }, 200);
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isDragging = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || closing) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      dragOffset = diff;
    } else {
      dragOffset = 0;
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (dragOffset > 70) {
      dragOffset = 500;
      closing = true;
      setTimeout(() => {
        closing = false;
        dragOffset = 0;
        onClose();
      }, 200);
    } else {
      dragOffset = 0;
    }
  }

  async function loadDetail(id: string, level: string) {
    if (!id) return;
    loading = true;
    try {
      const j = await api.songV1(id, level);
      if (j?.code && j.code !== '000000') {
        showToast(j.msg || '获取单曲详情失败', 'warning');
        return;
      }
      songInfo = j?.data || null;
      if (!songInfo) {
        showToast('未检索到该单曲详情数据', 'warning');
      }
    } catch (e: any) {
      showToast('获取单曲失败: ' + (e.message || e), 'error');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadDetail(songId, songLevel);
  });

  function handleLevelChange(newLevel: string) {
    songLevel = newLevel;
    loadDetail(songId, newLevel);
  }

  async function handleDownloadSingle(id: string, name?: string) {
    if (downloading) return;
    downloading = true;
    try {
      const res = await api.downloadSingle(id);
      const task = res?.data;
      if (task && typeof task === 'object') {
        if (task.status === 'SKIP') {
          showToast(`已跳过《${task.name || name || '歌曲'}》: ${task.errorMsg || '试听片段或已存在'}`, 'warning', 4000);
        } else if (task.status === 'FAILED') {
          showToast(`下载失败《${task.name || name || '歌曲'}》: ${task.errorMsg || '任务执行异常'}`, 'error', 5000);
        } else {
          showToast(`已提交单曲下载: 《${task.name || name || '歌曲'}》`, 'success');
        }
      } else {
        showToast(`已提交下载任务`, 'success');
      }
    } catch (e: any) {
      showToast('下载请求失败: ' + (e.message || e), 'error');
    } finally {
      downloading = false;
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`已复制${label}: ${text}`, 'success');
    } catch {
      showToast(`复制失败: ${text}`, 'warning');
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && handleClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 w-screen h-screen bg-black/65 backdrop-blur-md z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-4 box-border {closing ? 'animate-[modalFadeIn_0.2s_ease-out_reverse]' : 'animate-[modalFadeIn_0.2s_ease-out]'}"
  onclick={(e) => e.target === e.currentTarget && handleClose()}
>
  <div
    class="bg-[var(--card-bg-solid,#0f172a)] border border-[var(--border-color,rgba(255,255,255,0.18))]
      w-full max-sm:rounded-t-[22px] max-sm:rounded-b-none max-sm:border-b-0 max-sm:max-h-[88vh]
      sm:rounded-2xl sm:max-w-[580px] sm:max-h-[85vh]
      shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col box-border
      {closing && dragOffset === 0
        ? 'max-sm:animate-[drawerSlideDownSP_0.2s_ease-in] sm:animate-[modalFadeIn_0.2s_ease-out_reverse]'
        : 'max-sm:animate-[drawerSlideUpSP_0.25s_cubic-bezier(0.16,1,0.3,1)] sm:animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]'}"
    style={dragOffset > 0 ? `transform: translateY(${dragOffset}px); transition: ${isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'};` : ''}
    onclick={(e) => e.stopPropagation()}
  >
    <!-- 📱 移动端下拉手柄 (Drag handle) -->
    <div
      class="w-full pt-2.5 pb-1 flex sm:hidden justify-center cursor-grab active:cursor-grabbing select-none touch-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="w-10 h-1 rounded-full bg-white/30"></div>
    </div>

    <!-- Header 标题栏 -->
    <div
      class="px-5 py-3 border-b border-[var(--border-subtle,rgba(255,255,255,0.08))] flex justify-between items-center bg-black/5 dark:bg-white/[0.02] select-none"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <div class="flex items-center gap-2 font-bold text-[var(--text-main,#f8fafc)] text-[15px]">
        <span>🎧</span>
        <span>单曲详情与音质</span>
      </div>
      <button
        type="button"
        class="w-7 h-7 rounded-full flex items-center justify-center text-sm text-[var(--text-muted,#94a3b8)] hover:text-[var(--text-main,#ffffff)] hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={handleClose}
        title="关闭"
      >
        ✕
      </button>
    </div>

    <!-- Body 内容区 -->
    <div class="p-4 sm:p-5 overflow-y-auto text-[var(--text-main,#cbd5e1)] text-[13.5px] leading-relaxed flex-1 overscroll-contain">
      {#if loading && !songInfo}
        <div class="py-12 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center gap-3">
          <div class="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin"></div>
          <span>正在解析单曲信息与音频数据...</span>
        </div>
      {:else if songInfo}
        {@const targetId = songInfo.id || songId}
        {@const status = getTrackSourceStatus(targetId, songInfo.isLocal, playerStore.activeTrack)}
        {@const isPlayingThis = playerStore.activeTrack && String(playerStore.activeTrack.id) === String(targetId)}
        {@const isPlaying = Boolean(isPlayingThis && playerStore.playing)}
        {@const arText = formatArtist(songInfo) || '群星 / 未知'}
        {@const alText = songInfo.al_name || songInfo.album || '暂无专辑'}
        {@const alId = songInfo.al_id || songInfo.albumId || songInfo.al?.id}
        {@const sizeText = songInfo.size || '未知大小'}
        {@const levelText = songInfo.level || songLevel}
        {@const imgSrc = songInfo.pic || songInfo.picUrl || DEFAULT_VINYL_COVER}
        {@const isLiked = likedSet.has(Number(targetId))}

        <!-- 主卡片：封面 + 标题 + 核心元数据 -->
        <div class="flex flex-col sm:flex-row gap-3.5 items-start sm:items-center bg-black/5 dark:bg-white/[0.03] p-3 sm:p-4 rounded-2xl border border-black/5 dark:border-white/10 mb-4">
          <div class="relative group mx-auto sm:mx-0 shrink-0">
            <img
              src={imgSrc}
              alt={songInfo.name || '歌曲封面'}
              class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shadow-lg border border-black/10 dark:border-white/10"
              referrerpolicy="no-referrer"
              onerror={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.src.includes('favicon.png')) img.src = DEFAULT_VINYL_COVER; }}
            />
            {#if isPlaying}
              <div class="absolute inset-0 bg-black/40 backdrop-blur-xs rounded-xl flex items-center justify-center">
                <span class="text-white text-xl animate-pulse">🔊</span>
              </div>
            {/if}
          </div>

          <div class="flex-1 min-w-0 w-full">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-base sm:text-lg font-bold text-[var(--text-main)] truncate m-0" title={songInfo.name}>
                {songInfo.name || songInfo.songName || '未知歌曲'}
              </h3>
              {#if status.isLocal}
                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                  本地
                </span>
              {/if}
            </div>

            <div class="text-xs text-[var(--text-secondary)] truncate mb-1">
              歌手：<span class="font-medium text-[var(--text-main)]">{arText}</span>
            </div>

            <div class="text-xs text-[var(--text-secondary)] truncate mb-2 flex items-center gap-1.5">
              <span>专辑：</span>
              {#if alId && onAlbum}
                <button
                  type="button"
                  class="text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate bg-transparent border-none p-0 cursor-pointer text-left"
                  onclick={() => {
                    onAlbum(String(alId));
                    handleClose();
                  }}
                >
                  {alText}
                </button>
              {:else}
                <span class="truncate">{alText}</span>
              {/if}
            </div>

            <!-- 音质选择与文件大小 -->
            <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-black/5 dark:border-white/5">
              <div class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>音质:</span>
                <select
                  value={songLevel}
                  onchange={(e) => handleLevelChange((e.currentTarget as HTMLSelectElement).value)}
                  class="text-xs py-1 px-2 rounded-lg bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[var(--text-main)] cursor-pointer outline-none font-medium"
                >
                  <option value="standard">标准 (128k)</option>
                  <option value="exhigh">极高 (320k)</option>
                  <option value="lossless">无损 (FLAC)</option>
                  <option value="hires">Hi-Res</option>
                </select>
              </div>
              <span class="text-xs text-[var(--text-muted)] font-mono">
                {sizeText} · {levelText}
              </span>
            </div>
          </div>
        </div>

        <!-- 交互操作按钮组 -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <!-- 播放/暂停 -->
          <button
            type="button"
            class="btn-primary flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer shadow-xs active:scale-95 transition-all"
            onclick={() => {
              if (isPlayingThis) {
                playerStore.togglePlay();
              } else if (onPlayQueue) {
                onPlayQueue([toPlayerTrack(songInfo, { id: targetId, artist: arText, isLocal: status.isLocal })]);
              }
            }}
          >
            <span>{isPlaying ? '⏸️' : '▶️'}</span>
            <span>{isPlaying ? '暂停播放' : '立即试听'}</span>
          </button>

          <!-- 下载单曲 -->
          <button
            type="button"
            disabled={downloading}
            class="btn-secondary flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
            onclick={() => handleDownloadSingle(String(targetId), songInfo.name)}
          >
            <span>{downloading ? '🔄' : '📥'}</span>
            <span>{downloading ? '提交中...' : '下载单曲'}</span>
          </button>

          <!-- 收藏到歌单 -->
          <button
            type="button"
            class="btn-secondary flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-medium cursor-pointer active:scale-95 transition-all"
            onclick={() => {
              addToPlaylistSong = { id: targetId, name: songInfo.name || songInfo.songName, artist: arText };
            }}
          >
            <span>➕</span>
            <span>收藏到歌单</span>
          </button>

          <!-- 收藏到我喜欢 -->
          {#if onToggleLike}
            <button
              type="button"
              class="btn-secondary flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-medium cursor-pointer active:scale-95 transition-all {isLiked ? 'text-red-400 border-red-500/30' : ''}"
              onclick={() => onToggleLike(Number(targetId), songInfo.name, arText)}
            >
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{isLiked ? '已设喜欢' : '我的喜欢'}</span>
            </button>
          {/if}
        </div>

        <!-- 歌词预览面板 -->
        <div class="mb-3">
          <div class="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
            <span>📜</span>
            <span>歌词内容</span>
          </div>
          <div class="max-h-[140px] overflow-y-auto bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5 text-xs text-[var(--text-secondary)] font-mono leading-relaxed select-text">
            <pre class="m-0 font-inherit whitespace-pre-wrap">{songInfo.lyric || '暂无滚动歌词数据'}</pre>
          </div>
        </div>

        <!-- 查看原始 Raw JSON -->
        <div>
          <details class="border border-black/10 dark:border-white/10 rounded-xl p-2.5 bg-black/5 dark:bg-white/[0.02]">
            <summary class="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer select-none">
              📄 查看接口 Raw JSON 详情
            </summary>
            <pre class="bg-black/30 dark:bg-[#0b101b] text-sky-400 p-3 rounded-lg text-[11px] max-h-[180px] overflow-y-auto mt-2 font-mono border border-white/5 whitespace-pre-wrap select-all">{JSON.stringify(songInfo.rawData || songInfo, null, 2)}</pre>
          </details>
        </div>
      {:else}
        <div class="py-12 text-center text-xs text-[var(--text-muted)]">
          未找到该歌曲详情信息
        </div>
      {/if}
    </div>

    <!-- Footer 底部栏 -->
    <div class="px-5 py-2.5 border-t border-[var(--border-subtle,rgba(255,255,255,0.08))] flex justify-center sm:justify-start items-center bg-black/5 dark:bg-white/[0.02] pb-[calc(12px+env(safe-area-inset-bottom,0px))] sm:pb-2.5">
      <button
        type="button"
        class="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
        onclick={() => copyText(String(songId), '歌曲 ID')}
      >
        📋 复制歌曲 ID: {songId}
      </button>
    </div>
  </div>
</div>

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}
