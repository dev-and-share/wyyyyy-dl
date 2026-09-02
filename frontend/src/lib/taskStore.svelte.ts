import { api } from './api';

const ACTIVE_STATUSES = new Set(['WAITING', 'DOWNLOADING', 'PENDING']);

export const taskState = $state<{
  tasks: any[];
  downloadedSet: Set<number>;
  monVisible: boolean;
}>({
  tasks: [],
  downloadedSet: new Set<number>(),
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
        if ((t.status === 'SUCCESS' || t.status === 'SKIP') && (t.songId || t.id)) {
          const sid = Number(t.songId || t.id);
          if (!newSet.has(sid)) {
            newSet.add(sid);
            changed = true;
          }
        }
      });
      if (changed) taskState.downloadedSet = newSet;
      // 全部任务完成后自动停止轮询
      if (!taskState.tasks.some((t: any) => ACTIVE_STATUSES.has(t.status))) {
        stopTaskPolling();
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
      taskState.downloadedSet = new Set(j.data.map(Number));
      return;
    }
    const h = await api.historyList('', 1);
    taskState.downloadedSet = new Set((h?.data?.list || []).map((x: any) => Number(x.songId)).filter(Boolean));
  } catch {}
}
