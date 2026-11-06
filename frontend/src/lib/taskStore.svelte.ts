import { api } from './api';

const ACTIVE_STATUSES = new Set(['WAITING', 'DOWNLOADING', 'PENDING']);

export const taskState = $state<{
  tasks: any[];
  downloadedSet: Set<number>;
  downloadedCustomSet: Set<string>;
  monVisible: boolean;
}>({
  tasks: [],
  downloadedSet: new Set<number>(),
  downloadedCustomSet: new Set<string>(),
  monVisible: false
});

let taskTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 停止任务轮询，节省网络与服务器资源
 */
export function stopTaskPolling(): void {
  if (taskTimer !== null) {
    clearInterval(taskTimer);
    taskTimer = null;
  }
}

/**
 * 获取最新任务进度，并自适应判断是否需要继续轮询
 */
export async function fetchTasks(): Promise<void> {
  try {
    const j = await api.tasks();
    if (j.code === '000000') {
      taskState.tasks = j.data || [];
      if (taskState.tasks.length) taskState.monVisible = true;
      let changed = false;
      const newSet = new Set(taskState.downloadedSet);
      taskState.tasks.forEach((t: any) => {
        if (t.status === 'SUCCESS') {
          if (t.songId || t.id) {
            const sid = Number(t.songId || t.id);
            if (!isNaN(sid) && sid > 0 && !newSet.has(sid)) {
              newSet.add(sid);
              changed = true;
            }
          }
          const tName = (t.name || t.songName || '').trim();
          const tArtist = (t.artist || '').trim();
          if (tName && tArtist) {
            taskState.downloadedCustomSet.add(`${tName}___${tArtist}`);
          }
          if (typeof t.id === 'string' && t.id) {
            taskState.downloadedCustomSet.add(t.id);
          }
        }
      });
      if (changed) taskState.downloadedSet = newSet;
      // 全部任务完成后自动停止轮询并刷新一次历史落盘集合
      if (!taskState.tasks.some((t: any) => ACTIVE_STATUSES.has(t.status))) {
        stopTaskPolling();
        initDownloadedSet();
      }
    }
  } catch {}
}

/**
 * 启动 3 秒自适应任务轮询
 */
export function startTaskPolling(): void {
  if (taskTimer !== null) return;
  fetchTasks();
  taskTimer = setInterval(fetchTasks, 3000);
}

/**
 * 获取当前正在进行或排队的活跃下载任务数
 */
export function getActiveDownloadingCount(): number {
  return taskState.tasks.filter((t: any) => ACTIVE_STATUSES.has(t.status)).length;
}

/**
 * 清空任务列表
 */
export async function clearTasks(): Promise<void> {
  await api.tasksClear();
  taskState.tasks = [];
  stopTaskPolling();
}

/**
 * 初始化已下载本地歌曲集合
 */
export async function initDownloadedSet(): Promise<void> {
  try {
    const j = await api.historyIds();
    if (j?.code === '000000' && Array.isArray(j.data)) {
      taskState.downloadedSet = new Set(j.data.map(Number).filter((n: number) => !isNaN(n) && n > 0));
    }
    const h = await api.historyList('', 1, 500);
    if (h?.data?.list && Array.isArray(h.data.list)) {
      for (const item of h.data.list) {
        if (item.songId) {
          const num = Number(item.songId);
          if (!isNaN(num) && num > 0) taskState.downloadedSet.add(num);
        }
        const sName = (item.songName || item.name || '').trim();
        const sArtist = (item.artist || '').trim();
        if (sName && sArtist) {
          taskState.downloadedCustomSet.add(`${sName}___${sArtist}`);
        }
        if (item.filePath) {
          taskState.downloadedCustomSet.add(item.filePath);
        }
      }
    }
  } catch {}
}
