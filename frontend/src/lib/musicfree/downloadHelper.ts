import { api } from '../api';
import { extractRawAudioUrl, DEFAULT_VINYL_COVER } from '../utils';
import { musicFreeStore } from './musicFreeStore.svelte';
import { showToast } from '../toast.svelte';
import { t } from '../i18n';

/**
 * 🎯 统一执行第三方/外部音源曲目的下载与落盘 (Single Source of Truth)
 */
export async function downloadExternalTrack(
  track: any,
  rawTrack?: any,
  pluginId?: string
): Promise<boolean> {
  const songName = (track?.name || track?.title || '').trim();
  const artist = (track?.artist || '').trim();
  const album = (track?.album || track?.al?.name || '').trim();
  const coverUrl = track?.cover || track?.artwork || track?.al?.picUrl || DEFAULT_VINYL_COVER;
  const pId = pluginId || track?._pluginId || track?.pluginHash || track?.pluginId;

  showToast(t('download.submittedTask'), 'info', 1500);

  try {
    let audioUrl = track?.url;
    let headers = track?.headers;
    if (!audioUrl && pId) {
      const media = await musicFreeStore.resolveMediaSource(pId, rawTrack || track?.raw || track);
      audioUrl = media?.url;
      headers = media?.headers;
    }

    const cleanUrl = extractRawAudioUrl(audioUrl);
    if (!cleanUrl) {
      showToast(t('cache.cannotGetAudioStream'), 'error');
      return false;
    }

    const res = await api.downloadCustom({
      id: track?.id,
      name: songName,
      artist,
      album,
      url: cleanUrl,
      coverUrl,
      headers
    });

    if (res?.code === '000000') {
      showToast(t('download.submittedTask'), 'success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wyy:download-submitted'));
      }
      return true;
    } else {
      showToast(res?.msg || '创建下载任务失败', 'error');
      return false;
    }
  } catch (e: any) {
    showToast('创建下载任务失败: ' + (e.message || e), 'error');
    return false;
  }
}
