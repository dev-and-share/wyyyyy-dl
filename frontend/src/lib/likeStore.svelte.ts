import { api } from './api';
import { getApiCache, setApiCache } from './utils';
import { showToast } from './toast.svelte';

export const likeState = $state<{ likedSet: Set<number> }>({
  likedSet: new Set<number>()
});

/**
 * 初始化并拉取用户收藏的红心歌曲列表（支持 SWR 本地缓存瞬显）
 */
export async function initLikeList(): Promise<void> {
  const cache = getApiCache('liked_song_ids');
  if (cache?.data) {
    likeState.likedSet = new Set(cache.data.map((n: any) => Number(n)));
  }
  try {
    const j = await api.likeList();
    if (j?.code === '000000' && Array.isArray(j.data)) {
      likeState.likedSet = new Set(j.data.map((n: any) => Number(n)));
      setApiCache('liked_song_ids', j.data);
    }
  } catch {}
}

/**
 * 切换歌曲红心收藏状态（乐观更新 + 失败自动回滚 + Toast 提醒）
 */
export async function toggleLike(id: number, name: string): Promise<void> {
  const sid = Number(id);
  const isLiked = likeState.likedSet.has(sid);
  const nextSet = new Set(likeState.likedSet);

  if (isLiked) nextSet.delete(sid);
  else nextSet.add(sid);

  likeState.likedSet = nextSet;
  setApiCache('liked_song_ids', Array.from(nextSet));

  try {
    await api.like(sid, !isLiked);
    showToast(isLiked ? '已取消红心' : `已收藏 ${name}`, 'success');
  } catch {
    const rollback = new Set(likeState.likedSet);
    if (!isLiked) rollback.delete(sid);
    else rollback.add(sid);
    likeState.likedSet = rollback;
    showToast('收藏状态更新失败', 'error');
  }
}
