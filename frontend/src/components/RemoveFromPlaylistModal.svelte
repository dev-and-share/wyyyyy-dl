<script lang="ts">
  import { api } from '../lib/api';
  import { removeTrackFromCurrentPlaylist } from '../lib/playlist.svelte';
  import { removeTrackBrowserCache } from '../lib/browserCacheHelper';
  import { unmarkSongDownloaded } from '../lib/trackStatus.svelte';
  import Modal from './Modal.svelte';

  let {
    song,
    playlistId,
    playlistName = '当前歌单',
    zIndex = 'z-[100020]',
    onClose,
    onSuccess,
    showToast
  } = $props<{
    song: { id: string | number; name: string; artist?: string } | null;
    playlistId: string | number;
    playlistName?: string;
    zIndex?: string;
    onClose: () => void;
    onSuccess?: (detail: { removedFromPlaylist: boolean; removedBrowserCache: boolean; removedServerFile: boolean }) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let deleteBrowserCache = $state(true);
  let deleteServerFile = $state(false);
  let loading = $state(false);

  async function handleConfirm() {
    if (!song || loading) return;
    loading = true;
    try {
      // 1. 调用云端从歌单移除歌曲接口
      const res = await api.playlistRemove(String(playlistId), String(song.id));
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || '从歌单移除失败', 'warning');
        return;
      }

      // 2. 更新本地前端歌单曲目数组、曲目数与本地 API 缓存
      removeTrackFromCurrentPlaylist(playlistId, song.id);

      // 3. 若开启“删除浏览器缓存”，执行清理本设备 PWA Cache 与元数据
      let cacheRemoved = false;
      if (deleteBrowserCache) {
        try {
          cacheRemoved = await removeTrackBrowserCache(song.id);
        } catch (e) {
          console.warn('清理浏览器离线缓存失败:', e);
        }
      }

      // 4. 若开启“删除服务器的文件”，调用物理删除接口并同步取消下载标记
      let serverFileRemoved = false;
      if (deleteServerFile) {
        try {
          const sRes = await api.deleteSongFile(song.id, song.name, song.artist);
          if (sRes?.code === '000000' && sRes?.data) {
            serverFileRemoved = true;
            unmarkSongDownloaded(song.id);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('wyyyy:download-submitted'));
            }
          }
        } catch (e) {
          console.warn('删除服务器文件异常:', e);
        }
      }

      // 5. 组装操作成功提示文案
      const notes: string[] = [];
      if (deleteBrowserCache) notes.push('已清空浏览器离线缓存');
      if (serverFileRemoved) notes.push('已删除服务器文件');
      const suffix = notes.length > 0 ? ` (${notes.join('，')})` : '';
      showToast(`已从歌单「${playlistName}」移除《${song.name}》${suffix}`, 'success');

      onSuccess?.({
        removedFromPlaylist: true,
        removedBrowserCache: cacheRemoved,
        removedServerFile: serverFileRemoved
      });
      onClose();
    } catch (e: any) {
      showToast('操作失败: ' + (e.message || e), 'error');
    } finally {
      loading = false;
    }
  }
</script>

{#if song}
  <Modal title="从歌单移除歌曲" icon="🗑️" maxWidth="max-w-[460px]" {zIndex} {onClose}>
    <!-- 目标曲目与歌单卡片 -->
    <div class="flex items-center gap-3 p-3 rounded-2xl bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/10 mb-3.5">
      <div class="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center text-lg shrink-0">
        🎵
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-[var(--text-main)] truncate" title={song.name}>{song.name}</div>
        <div class="text-[11px] text-[var(--text-secondary)] truncate">
          {song.artist || '群星'} <span class="opacity-40">·</span> 所属: <strong class="text-[var(--text-main)] font-medium">{playlistName}</strong>
        </div>
      </div>
    </div>

    <p class="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
      确定要将此歌曲从该歌单中移除吗？此操作将同步更新云端歌单曲目。
    </p>

    <!-- 高级联动开关选项组 -->
    <div class="space-y-2 mb-4">
      <!-- 开关 1: 删除浏览器缓存 (默认 ON) -->
      <label
        class="flex items-center justify-between p-2.5 rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/[0.05] transition-colors cursor-pointer select-none"
      >
        <div class="flex items-start gap-2.5 min-w-0 pr-2">
          <span class="text-sm mt-0.5 shrink-0">📲</span>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
              <span>删除浏览器离线缓存</span>
              <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">推荐</span>
            </div>
            <div class="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
              清理当前设备 (PWA / CacheStorage) 中已缓存的离线音频流与元数据
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          data-testid="toggle-delete-browser-cache"
          bind:checked={deleteBrowserCache}
          class="w-4 h-4 accent-red-500 cursor-pointer shrink-0"
        />
      </label>

      <!-- 开关 2: 删除服务器的文件 (默认 OFF) -->
      <label
        class="flex items-center justify-between p-2.5 rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/5 dark:hover:bg-white/[0.05] transition-colors cursor-pointer select-none"
      >
        <div class="flex items-start gap-2.5 min-w-0 pr-2">
          <span class="text-sm mt-0.5 shrink-0">🖥️</span>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
              <span>删除电脑服务器上的物理文件</span>
              <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400">永久物理删除</span>
            </div>
            <div class="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
              物理擦除服务器电脑硬盘已下载的音频文件，并彻底清理历史记录数据库
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          data-testid="toggle-delete-server-file"
          bind:checked={deleteServerFile}
          class="w-4 h-4 accent-red-500 cursor-pointer shrink-0"
        />
      </label>
    </div>

    <!-- 底部操作按钮 -->
    <div class="flex justify-end items-center gap-2 pt-1 border-t border-black/5 dark:border-white/10">
      <button
        type="button"
        class="btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
        disabled={loading}
        onclick={onClose}
      >
        取消
      </button>
      <button
        type="button"
        data-testid="btn-confirm-remove"
        class="px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
        disabled={loading}
        onclick={handleConfirm}
      >
        {#if loading}
          <span class="inline-block animate-spin text-xs">⏳</span>
          <span>正在移除...</span>
        {:else}
          <span>🗑️ 确认移除</span>
        {/if}
      </button>
    </div>
  </Modal>
{/if}
