import { api } from './api';
import { isLocalPlaylist } from './localPlaylistStore.svelte';
import { downloadExternalTrack } from './musicfree/downloadHelper';
import { musicFreeStore } from './musicfree/musicFreeStore.svelte';
import { showToast } from './toast.svelte';
import { markSongDownloaded } from './trackStatus.svelte';
import { t } from './i18n';

/**
 * 🎯 统一歌单内单曲下载：区分云端数字 ID 与外部/本地歌单曲目
 */
export async function downloadPlaylistTrack(
  trackItem: any,
  playlistId: string,
  artistName?: string
): Promise<void> {
  const isLocalPl = isLocalPlaylist(playlistId);
  const numId = Number(trackItem?.id);
  const isNetEase = !isLocalPl && !isNaN(numId) && numId > 10000;

  if (isNetEase) {
    try {
      const res = await api.downloadSingle(String(trackItem.id));
      const task = res?.data;
      const songName = task?.name || trackItem.name || t('common.unknownSong');
      if (task?.status === 'SKIP') {
        const msg = task.errorMsg || '';
        if (msg.includes('已存在') || msg.includes('磁盘中')) {
          markSongDownloaded(trackItem.id);
          showToast(t('download.alreadyInDiskSynced', { name: songName }), 'info', 3000);
        } else {
          showToast(t('download.skippedWithName', { name: songName, reason: msg || t('download.skipReasonPreviewOrExist') }), 'warning', 4000);
        }
      } else if (task?.status === 'FAILED') {
        showToast(t('download.failedWithName', { name: songName, reason: task.errorMsg || t('download.failReasonExecuteError') }), 'error', 4000);
      } else {
        showToast(t('download.submitSuccessWithName', { name: songName }), 'info', 2000);
      }
      window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
    } catch (e: any) {
      showToast(t('download.requestFailed', { error: e?.message || e }), 'error');
    }
    return;
  }

  // 外部歌曲或本地歌单曲目下载落盘
  const artist = artistName || trackItem?.artist || '';
  const ok = await downloadExternalTrack(trackItem, trackItem?.raw, trackItem?._pluginId || trackItem?.pluginHash);
  if (!ok) {
    try {
      const searchRes = await musicFreeStore.searchAll(`${trackItem.name} ${artist}`);
      if (searchRes?.results?.length > 0) {
        const first = searchRes.results[0];
        await downloadExternalTrack(first, first.raw, first._pluginId || first.pluginHash);
      } else {
        showToast(t('cache.cannotGetAudioStream'), 'error');
      }
    } catch (err: any) {
      showToast('下载失败: ' + (err.message || err), 'error');
    }
  }
}
