<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { playerStore } from '../lib/playerStore.svelte';
  import { getTrackSourceStatus } from '../lib/trackStatus.svelte';
  import { toPlayerTrack } from '../lib/playerHelper';
  import Modal from './Modal.svelte';
  import AddToPlaylistModal from './AddToPlaylistModal.svelte';

  let {
    songId,
    likedSet = new Set<number>(),
    onToggleLike,
    onPlayQueue,
    onTogglePlay,
    onAlbum,
    onClose,
    showToast
  } = $props<{
    songId: string;
    likedSet?: Set<number>;
    onToggleLike?: (id: number, name: string, artist?: string) => void;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    onTogglePlay?: () => void;
    onAlbum?: (albumId: string, albumName?: string) => void;
    onClose: () => void;
    showToast: (m: string, t?: string, dur?: number) => void;
  }>();

  let songLevel = $state('lossless');
  let songInfo = $state<any>(null);
  let loading = $state(true);
  let downloading = $state(false);
  let addToPlaylistSong = $state<{ id: string | number; name: string; artist?: string } | null>(null);

  let alId = $derived(songInfo?.al_id || songInfo?.albumId || songInfo?.al?.id || '');
  let alText = $derived(songInfo?.al_name || songInfo?.album || songInfo?.al?.name || '暂无专辑');

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

<Modal
  title="单曲详情与音质"
  icon="🎧"
  maxWidth="max-w-[580px]"
  height="max-sm:h-[82vh] sm:h-[620px]"
  zIndex="z-[100020]"
  {onClose}
>
  <div>
    {#if loading && !songInfo}
      <!-- 💀 像素级 1:1 镜像骨架屏：与实际内容严格对齐，彻底消除切换时的任何颤抖与位移 -->
      <div class="flex flex-col select-none" data-testid="song-detail-skeleton">
        <!-- 1. 主卡片骨架 -->
        <div class="flex flex-col sm:flex-row gap-3.5 items-start sm:items-center bg-black/5 dark:bg-white/[0.03] p-3 sm:p-4 rounded-2xl border border-black/5 dark:border-white/10 mb-4 animate-pulse">
          <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-black/10 dark:bg-white/10 mx-auto sm:mx-0 shrink-0 flex items-center justify-center">
            <span class="text-3xl opacity-20">🎵</span>
          </div>
          <div class="flex-1 min-w-0 w-full flex flex-col gap-2 py-0.5">
            <div class="h-6 bg-black/10 dark:bg-white/10 rounded-md w-3/4 mb-0.5"></div>
            <div class="h-4 bg-black/10 dark:bg-white/10 rounded-md w-1/2"></div>
            <div class="h-4 bg-black/10 dark:bg-white/10 rounded-md w-2/3 mb-1"></div>
            <div class="pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-2">
              <div class="h-6 bg-black/10 dark:bg-white/10 rounded-lg w-28"></div>
              <div class="h-4 bg-black/10 dark:bg-white/10 rounded-md w-24"></div>
            </div>
          </div>
        </div>

        <!-- 2. 交互操作按钮组骨架 (严格镜像 2x2 移动端 / 1x4 桌面端) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 animate-pulse">
          <div class="h-[38px] sm:h-[34px] rounded-xl bg-black/10 dark:bg-white/10"></div>
          <div class="h-[38px] sm:h-[34px] rounded-xl bg-black/10 dark:bg-white/10"></div>
          <div class="h-[38px] sm:h-[34px] rounded-xl bg-black/10 dark:bg-white/10"></div>
          <div class="h-[38px] sm:h-[34px] rounded-xl bg-black/10 dark:bg-white/10"></div>
        </div>

        <!-- 3. 歌词预览骨架 -->
        <div class="mb-3">
          <div class="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
            <span>📜</span>
            <span>歌词内容</span>
          </div>
          <div class="h-[140px] bg-black/5 dark:bg-black/20 p-4 rounded-xl border border-black/5 dark:border-white/5 flex flex-col gap-2.5 justify-center items-center text-xs text-[var(--text-secondary)]">
            <div class="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin"></div>
            <span class="text-xs text-[var(--text-muted)] animate-pulse">正在解析单曲信息与高规格音频...</span>
          </div>
        </div>

        <!-- 4. Raw JSON 查看骨架占位 -->
        <div class="border border-black/10 dark:border-white/10 rounded-xl p-2.5 bg-black/5 dark:bg-white/[0.02] flex items-center animate-pulse">
          <div class="h-4 bg-black/10 dark:bg-white/10 rounded w-44"></div>
        </div>
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

      <div>
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
                    onAlbum(String(alId), alText);
                    onClose();
                  }}
                >
                  {alText}
                </button>
                <span class="text-[var(--text-muted)] text-[11px] font-mono shrink-0">({alId})</span>
              {:else}
                <span class="truncate">{alText}</span>
                {#if alId}
                  <span class="text-[var(--text-muted)] text-[11px] font-mono shrink-0">({alId})</span>
                {/if}
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
          <!-- 播放/暂停/试听 -->
          <button
            type="button"
            class="btn-primary flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer shadow-xs active:scale-95 transition-all"
            onclick={() => {
              if (isPlayingThis && isPlaying) {
                if (onTogglePlay) onTogglePlay();
                else playerStore.togglePlay();
              } else if (isPlayingThis && onTogglePlay) {
                onTogglePlay();
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
      </div>
    {:else}
      <div class="py-12 text-center text-xs text-[var(--text-muted)]">
        未找到该歌曲详情信息
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <div class="w-full flex justify-between items-center select-none gap-2 flex-wrap">
      <div class="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          class="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
          onclick={() => copyText(String(songId), '歌曲 ID')}
        >
          📋 复制歌曲 ID: {songId}
        </button>
        {#if alId}
          <button
            type="button"
            class="text-xs text-[var(--text-muted)] hover:text-blue-400 bg-transparent border-none cursor-pointer flex items-center gap-1 transition-colors"
            onclick={() => copyText(String(alId), '专辑 ID')}
          >
            📋 复制专辑 ID: {alId}
          </button>
        {/if}
      </div>
      <button
        type="button"
        class="btn-secondary px-3 py-1 text-xs rounded-lg cursor-pointer ml-auto"
        onclick={onClose}
      >
        关闭
      </button>
    </div>
  {/snippet}
</Modal>

{#if addToPlaylistSong}
  <AddToPlaylistModal
    song={addToPlaylistSong}
    onClose={() => addToPlaylistSong = null}
    {showToast}
  />
{/if}
