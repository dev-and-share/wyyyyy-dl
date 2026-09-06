<script lang="ts">
  import { onMount } from 'svelte';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import { formatBytes, formatArtist, DEFAULT_VINYL_COVER } from '../lib/utils';

  let {
    onPlayQueue,
    showToast = () => {}
  } = $props<{
    onPlayQueue: (tracks: any[], idx?: number) => void;
    showToast?: (msg: string, type?: 'info'|'success'|'warning'|'error', dur?: number) => void;
  }>();

  let accBrowserCache = $state(true);

  type BrowserCacheItem = {
    key: string;
    urls: string[];
    relUrls: string[];
    relUrl: string;
    name: string;
    artist: string;
    size: number;
  };
  let browserCacheList: BrowserCacheItem[] = $state([]);
  let browserCacheBytes = $state(0);
  let browserCacheLoading = $state(false);

  function isAudioCacheUrl(url: string) {
    return url.includes('/v2/stream') || url.includes('/v2/history/stream');
  }

  function readCachedTrackMeta() {
    try {
      return JSON.parse(localStorage.getItem('pwa_cached_tracks_meta_v1') || '{}');
    } catch {
      return {};
    }
  }

  async function loadBrowserCacheList() {
    if (!('caches' in window)) {
      showToast('当前浏览器不支持离线缓存', 'warning');
      return;
    }
    browserCacheLoading = true;
    try {
      const metaMap = readCachedTrackMeta();
      const byKey = new Map<string, BrowserCacheItem>();
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) {
          if (!isAudioCacheUrl(request.url)) continue;
          const relUrl = request.url.replace(window.location.origin, '');
          const meta = metaMap[relUrl] || metaMap[request.url] || {};
          const response = await cache.match(request);
          const size = Number(response?.headers.get('content-length') || meta.fileSize || 0);

          // 提取真实歌曲 ID 与历史记录 ID
          const urlIdMatch = relUrl.match(/[?&]id=([1-9]\d*)/);
          const urlHistMatch = relUrl.match(/[?&]historyId=(\d+)/);
          const songId = meta.id && String(meta.id) !== '0' ? String(meta.id) : (urlIdMatch ? urlIdMatch[1] : null);

          const songName = (meta.songName || '').trim();
          const songArtist = formatArtist(meta.artist) || '';

          // 🎵 逻辑唯一键：优先真实歌曲 ID (song_xxx)，其次标准化歌名+歌手 (meta_name_artist)，兜底 relUrl
          const uniqueKey = songId
            ? `song_${songId}`
            : (songName ? `meta_${songName}_${songArtist}` : relUrl);

          if (byKey.has(uniqueKey)) {
            const existing = byKey.get(uniqueKey)!;
            // 🛡️ 检测底层物理 Cache 是否存了非标准冗余 Key：
            // 如果已存在或当前是标准规范 Key (/v2/stream?id=xxx)，则物理删除非标准冗余项，释放磁盘！
            const isCurrentCanonical = urlIdMatch && !relUrl.includes('historyId=');
            const isExistingCanonical = existing.relUrl.match(/[?&]id=([1-9]\d*)/) && !existing.relUrl.includes('historyId=');

            if (isCurrentCanonical && !isExistingCanonical) {
              // 当前是标准 Key，物理清除之前的非标准冗余条目
              for (const oldUrl of existing.urls) {
                await cache.delete(oldUrl).catch(() => {});
              }
              existing.urls = [request.url];
              existing.relUrls = [relUrl];
              existing.relUrl = relUrl;
            } else if (isExistingCanonical && !isCurrentCanonical) {
              // 之前已是标准 Key，物理清除当前非标准冗余条目
              await cache.delete(request).catch(() => {});
            } else {
              if (!existing.urls.includes(request.url)) existing.urls.push(request.url);
              if (!existing.relUrls.includes(relUrl)) existing.relUrls.push(relUrl);
            }
            existing.size = Math.max(existing.size, size);
          } else {
            byKey.set(uniqueKey, {
              key: uniqueKey,
              urls: [request.url],
              relUrls: [relUrl],
              relUrl,
              name: songName || (songId ? `离线音轨 #${songId}` : (urlHistMatch ? `本地音轨 #${urlHistMatch[1]}` : '本地缓存音频')),
              artist: songArtist || '浏览器已离线',
              size
            });
          }
        }
      }
      browserCacheList = [...byKey.values()];
      browserCacheBytes = browserCacheList.reduce((total, item) => total + item.size, 0);
    } catch (e: any) {
      showToast('扫描浏览器缓存失败: ' + (e.message || e), 'error');
    } finally {
      browserCacheLoading = false;
    }
  }

  async function deleteBrowserCacheItem(item: BrowserCacheItem) {
    if (!confirm(`删除“${item.name}”的手机离线缓存？删除后断网将无法播放。`)) return;
    try {
      const metaMap = readCachedTrackMeta();
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const url of item.urls) {
          await cache.delete(url);
        }
      }
      for (const rUrl of item.relUrls) {
        delete metaMap[rUrl];
      }
      for (const fUrl of item.urls) {
        delete metaMap[fUrl];
      }
      localStorage.setItem('pwa_cached_tracks_meta_v1', JSON.stringify(metaMap));
      window.dispatchEvent(new CustomEvent('wyyyy:browser-cache-updated'));
      await loadBrowserCacheList();
      showToast('已删除该首离线缓存', 'success');
    } catch (e: any) {
      showToast('删除缓存失败: ' + (e.message || e), 'error');
    }
  }

  async function clearBrowserCache() {
    if (!confirm('清空当前设备上的所有离线音乐缓存？这不会影响服务器文件。')) return;
    try {
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) {
          if (isAudioCacheUrl(request.url)) await cache.delete(request);
        }
      }
      localStorage.removeItem('pwa_cached_tracks_meta_v1');
      window.dispatchEvent(new CustomEvent('wyyyy:browser-cache-updated'));
      await loadBrowserCacheList();
      showToast('已清空当前设备的离线音乐缓存', 'success');
    } catch (e: any) {
      showToast('清空缓存失败: ' + (e.message || e), 'error');
    }
  }

  let wasOpen = false;
  $effect(() => {
    if (accBrowserCache && !wasOpen) {
      loadBrowserCacheList();
    }
    wasOpen = accBrowserCache;
  });

  onMount(() => {
    loadBrowserCacheList();
    const onCacheUpdate = () => {
      loadBrowserCacheList();
    };
    window.addEventListener('wyyyy:browser-cache-updated', onCacheUpdate);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && accBrowserCache) {
        loadBrowserCacheList();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('wyyyy:browser-cache-updated', onCacheUpdate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });
</script>

<AccordionCard title="📲 3. 手机离线缓存管理" bind:open={accBrowserCache}>
  <div style="display:flex; flex-wrap:wrap; gap:8px; background:var(--stat-bar-bg); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:8px; margin-bottom:10px; align-items:center; font-size:13px;">
    <span>已缓存歌曲：<strong>{browserCacheList.length}</strong> 首</span>
    <span>音频大小：<strong>{browserCacheBytes ? formatBytes(browserCacheBytes) : '-'}</strong></span>
    <div style="margin-left:auto; display:flex; gap:6px;">
      <button class="btn-secondary" style="padding:5px 10px; font-size:12px;" onclick={loadBrowserCacheList} disabled={browserCacheLoading}>
        {browserCacheLoading ? '🔄 扫描中…' : '🔄 刷新缓存'}
      </button>
      <button class="btn-secondary" style="padding:5px 10px; font-size:12px; color:#ef4444;" onclick={clearBrowserCache} disabled={browserCacheLoading || browserCacheList.length === 0}>🗑️ 清除缓存</button>
    </div>
  </div>

  <ul class="data-list scrollable-list">
    {#each browserCacheList as item}
      <li class="track-item-card">
        <div class="track-title-row">
          <span class="font-bold truncate">{item.name}</span>
          <span class="text-xs text-[var(--text-secondary)] truncate"> - {item.artist}</span>
          <span class="audio-source-badge icon-only badge-browser ml-1.5" title="已存储在当前手机/浏览器">📲</span>
        </div>
        <div class="track-action-group">
          <span class="text-xs text-[var(--text-secondary)]">{item.size ? formatBytes(item.size) : '离线存储'}</span>
          <SlotBtn onclick={() => onPlayQueue([{ id: item.relUrl, name: item.name, artist: item.artist, cover: DEFAULT_VINYL_COVER, url: item.relUrl }])}>▶️ 播放</SlotBtn>
          <SlotBtn onclick={() => deleteBrowserCacheItem(item)}>🗑️ 删除</SlotBtn>
        </div>
      </li>
    {:else}
      <li style="padding:20px; text-align:center; color:var(--text-muted);">{browserCacheLoading ? '正在扫描手机离线缓存…' : '当前设备暂无离线音乐缓存'}</li>
    {/each}
  </ul>
</AccordionCard>
