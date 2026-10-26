import { api } from './api';
import { t } from './i18n';

export async function executeReveal(item: any): Promise<{ path: string; msg: string }> {
  const j = await api.reveal({
    id: item.songId || item.id,
    name: item.name || item.songName,
    artist: item.artist || item.ar_name,
    path: item.path || item.filePath,
    taskId: item.taskId
  });
  if (j?.code === '000000') {
    return {
      path: j.data || item.path || item.filePath || '',
      msg: t('reveal.successMsg')
    };
  }
  return {
    path: item.path || item.filePath || j?.data || '',
    msg: j?.msg || t('reveal.notFoundMsg')
  };
}
