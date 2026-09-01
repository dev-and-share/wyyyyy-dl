import { api } from './api';

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
      msg: '🚀 已为您在系统文件管理器中定位物理文件！'
    };
  }
  return {
    path: item.path || item.filePath || j?.data || '',
    msg: j?.msg || '未找到文件物理路径'
  };
}
