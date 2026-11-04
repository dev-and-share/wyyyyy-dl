import { api } from './api';
import { t } from './i18n';

export async function executeReveal(item: any): Promise<{ path: string; msg: string }> {
  const rawPath = item.path || item.filePath || '';
  const isOnlineUrl = rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('/v3/stream');
  const cleanPath = isOnlineUrl ? '' : rawPath;

  const j = await api.reveal({
    id: item.songId || item.id,
    name: item.name || item.songName,
    artist: item.artist || item.ar_name,
    path: cleanPath,
    taskId: item.taskId
  });

  if (j?.code === '000000' && j.data) {
    return {
      path: j.data,
      msg: t('reveal.successMsg')
    };
  }

  throw new Error(j?.msg || '该歌曲尚未下载到本地磁盘（或正在后台下载中）');
}
