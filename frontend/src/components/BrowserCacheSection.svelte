<script lang="ts">
  import { onMount } from 'svelte';
  import AccordionCard from './AccordionCard.svelte';
  import SlotBtn from './SlotBtn.svelte';
  import { formatBytes, DEFAULT_VINYL_COVER } from '../lib/utils';
  import { autoCacheState, setAutoCacheEnabled } from '../lib/pwaCache.svelte';
  import { openSheet } from '../lib/ui.svelte';
  import { playerStore } from '../lib/playerStore.svelte';
  import {
    type BrowserCacheItem,
    scanBrowserCache,
    deleteBrowserCacheEntry,
    clearLowPlayCountCacheEntries,
    clearAllBrowserAudioCache,
    formatCacheDate
  } from '../lib/browserCacheHelper';

  let {
    onPlayQueue,
    showToast = () => {}
  } = $props<{
    onPlayQueue: (tracks: any[], idx?: number) => void;
    showToast?: (msg: string, type?: 'info'|'success'|'warning'|'error', dur?: number) => void;
  }>();

  let accBrowserCache = $state(true);
  let browserCacheList: BrowserCacheItem[] = $state([]);
  let browserCacheBytes = $state(0);
  let browserCacheLoading = $state(false);
  let minPlayThreshold = $state(2);

  async function loadList() {
    if (!('caches' in window)) {
      showToast('当前浏览器不支持离线缓存', 'warning');
      return;
    }
    browserCacheLoading = true;
    try {
      const res = await scanBrowserCache();
      browserCacheList = res.list;
      browserCacheBytes = res.totalBytes;
    } catch (e: any) {
      showToast('扫描浏览器缓存失败: ' + (e.message || e), 'error');
    } finally {
      browserCacheLoading = false;
    }
  }

  async function handleDeleteItem(item: BrowserCacheItem) {
    if (!confirm(`删除“${item.name}”的手机离线缓存？删除后断网将无法播放。`)) return;
    try {
      await deleteBrowserCacheEntry(item);
      await loadList();
      showToast('已删除该首离线缓存', 'success');
    } catch (e: any) {
      showToast('删除缓存失败: ' + (e.message || e), 'error');
    }
  }

  async function handleClearLowPlayCount() {
    const threshold = Math.max(1, Number(minPlayThreshold) || 2);
    const lowItems = browserCacheList.filter((item) => item.playCount < threshold);
    if (lowItems.length === 0) {
      showToast(`当前没有播放次数少于 ${threshold} 次的离线歌曲`, 'info', 2000);
      return;
    }
    const freedBytes = lowItems.reduce((acc, item) => acc + item.size, 0);
    const ok = confirm(`确定清除 ${lowItems.length} 首播放少于 ${threshold} 次的离线歌曲？\n预计释放手机存储空间: ${formatBytes(freedBytes)}。\n（服务器下载文件不受影响）`);
    if (!ok) return;

    browserCacheLoading = true;
    try {
      await clearLowPlayCountCacheEntries(lowItems);
      await loadList();
      showToast(`已成功清理 ${lowItems.length} 首低频缓存，释放 ${formatBytes(freedBytes)} 空间`, 'success', 2500);
    } catch (e: any) {
      showToast('批量清理低频缓存失败: ' + (e.message || e), 'error');
    } finally {
      browserCacheLoading = false;
    }
  }

  async function handleClearAll() {
    if (!confirm('清空当前设备上的所有离线音乐缓存？这不会影响服务器文件。')) return;
    try {
      await clearAllBrowserAudioCache();
      await loadList();
      showToast('已清空当前设备的离线音乐缓存', 'success');
    } catch (e: any) {
      showToast('清空缓存失败: ' + (e.message || e), 'error');
    }
  }

  function openTrackSheet(item: BrowserCacheItem) {
    const isPlayingThis = playerStore.playing && (
      String(playerStore.activeTrack?.id) === String(item.id) ||
      playerStore.activeTrack?.url === item.relUrl
    );

    openSheet({
      title: item.name,
      subtitle: `${item.artist} · ${item.size ? formatBytes(item.size) : '离线存储'} · 播放 ${item.playCount} 次${item.time ? ' · 缓存于 ' + formatCacheDate(item.time) : ''}`,
      actions: [
        {
          label: isPlayingThis ? '⏸ 暂停播放' : '▶️ 立即播放',
          style: 'primary',
          onclick: () => onPlayQueue([{
            id: item.id || item.relUrl,
            name: item.name,
            artist: item.artist,
            cover: DEFAULT_VINYL_COVER,
            url: item.relUrl
          }])
        },
        {
          label: `🗑️ 删除此首离线缓存 (${item.size ? formatBytes(item.size) : '释放空间'})`,
          style: 'danger',
          onclick: () => handleDeleteItem(item)
        }
      ]
    });
  }

  let wasOpen = false;
  $effect(() => {
    if (accBrowserCache && !wasOpen) {
      loadList();
    }
    wasOpen = accBrowserCache;
  });

  onMount(() => {
    loadList();
    const onCacheUpdate = () => { loadList(); };
    const onPlayUpdate = () => { loadList(); };
    window.addEventListener('wyyyy:browser-cache-updated', onCacheUpdate);
    window.addEventListener('wyyyy:song-play-updated', onPlayUpdate);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && accBrowserCache) {
        loadList();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('wyyyy:browser-cache-updated', onCacheUpdate);
      window.removeEventListener('wyyyy:song-play-updated', onPlayUpdate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });
</script>

<AccordionCard title="📲 3. 手机离线缓存管理" bind:open={accBrowserCache}>
  <!-- 统计与操作控制条 -->
  <div class="cache-stat-bar">
    <div class="stat-top-row">
      <div class="stat-info">
        <span>已缓存：<strong>{browserCacheList.length}</strong> 首</span>
        <span class="stat-divider">·</span>
        <span>大小：<strong>{browserCacheBytes ? formatBytes(browserCacheBytes) : '-'}</strong></span>
      </div>
      
      <!-- 边听边存 Checkbox -->
      <label class="auto-cache-toggle" title="只要听过的非试听歌曲，都在后台自动离线缓存到手机">
        <input
          type="checkbox"
          checked={autoCacheState.enabled}
          onchange={(e) => {
            const val = (e.currentTarget as HTMLInputElement).checked;
            setAutoCacheEnabled(val);
            showToast(val ? '✅ 已开启边听边存（听过即存手机）' : 'ℹ️ 已关闭边听边存', 'info', 1500);
          }}
        />
        <span class="font-medium text-[var(--text-main)]">🎧 边听边存</span>
      </label>
    </div>

    <div class="stat-actions-row">
      <button class="btn-secondary cache-action-btn" onclick={loadList} disabled={browserCacheLoading}>
        {browserCacheLoading ? '🔄 扫描中…' : '🔄 刷新'}
      </button>

      <!-- 一键清除少于 N 次播放的缓存 -->
      <div class="clean-low-control" title="一键清理播放次数少于阈值的低频离线歌曲">
        <button
          class="clean-low-btn"
          onclick={handleClearLowPlayCount}
          disabled={browserCacheLoading || browserCacheList.length === 0}
        >
          🧹 清除 &lt;
        </button>
        <input
          type="number"
          min="1"
          max="99"
          class="clean-n-input"
          bind:value={minPlayThreshold}
          onclick={(e) => e.stopPropagation()}
        />
        <span class="clean-unit-text">次</span>
      </div>

      <button class="btn-secondary cache-action-btn btn-danger" onclick={handleClearAll} disabled={browserCacheLoading || browserCacheList.length === 0}>
        🗑️ 清空
      </button>
    </div>
  </div>

  <!-- 排序规则提示条 -->
  <div class="cache-sort-hint-bar">
    <div class="hint-text-wrap">
      <span class="hint-icon">📌</span>
      <span class="hint-label">排序规则：<strong class="text-[var(--text-main)]">播放次数 ↓</strong> &gt; <strong class="text-[var(--text-main)]">缓存时间 ↓</strong><span class="hidden sm:inline">（高频先听，越新越前）</span></span>
    </div>
    <span class="hint-badge">共 {browserCacheList.length} 首离线</span>
  </div>

  <!-- 离线缓存曲目列表 -->
  <ul class="data-list scrollable-list">
    {#each browserCacheList as item}
      {@const isPlayingThis = playerStore.playing && (String(playerStore.activeTrack?.id) === String(item.id) || playerStore.activeTrack?.url === item.relUrl)}
      <li class="track-item-card" class:is-active-playing={isPlayingThis}>
        <div class="track-title-row">
          <span class="font-bold truncate">{item.name}</span>
          <span class="text-xs text-[var(--text-secondary)] truncate"> - {item.artist}</span>
          <span class="audio-source-badge icon-only badge-browser ml-1 flex-shrink-0" title="已存储在当前手机/浏览器">📲</span>
          
          <!-- 播放次数徽标 -->
          <span class="play-count-badge ml-1 flex-shrink-0" title="累计播放 {item.playCount} 次">
            🎧 {item.playCount}次
          </span>
        </div>

        <!-- 💻 PC 桌面端：完整操作按钮组 -->
        <div class="hidden md:inline-flex items-center gap-2 track-action-group">
          {#if item.time}
            <span class="text-xs text-[var(--text-muted)] font-mono cache-time-tag" title="缓存入库时间">
              {formatCacheDate(item.time)}
            </span>
          {/if}
          <span class="text-xs text-[var(--text-secondary)]">{item.size ? formatBytes(item.size) : '离线存储'}</span>
          <SlotBtn
            playing={isPlayingThis}
            onclick={() => onPlayQueue([{ id: item.id || item.relUrl, name: item.name, artist: item.artist, cover: DEFAULT_VINYL_COVER, url: item.relUrl }])}
          >
            {isPlayingThis ? '⏸ 播放中' : '▶️ 播放'}
          </SlotBtn>
          <SlotBtn onclick={() => handleDeleteItem(item)}>🗑️ 删除</SlotBtn>
        </div>

        <!-- 📱 SP 移动端：保持核心 ▶️ 播放 + ··· 更多操作抽屉 -->
        <div class="inline-flex md:hidden items-center gap-1.5 flex-shrink-0">
          <SlotBtn
            playing={isPlayingThis}
            onclick={() => onPlayQueue([{ id: item.id || item.relUrl, name: item.name, artist: item.artist, cover: DEFAULT_VINYL_COVER, url: item.relUrl }])}
          >
            {isPlayingThis ? '⏸' : '▶️ 播放'}
          </SlotBtn>
          <button
            type="button"
            class="btn-more-actions"
            onclick={() => openTrackSheet(item)}
            title="更多操作"
            aria-label="更多操作"
          >
            ···
          </button>
        </div>
      </li>
    {:else}
      <li style="padding:20px; text-align:center; color:var(--text-muted);">{browserCacheLoading ? '正在扫描手机离线缓存…' : '当前设备暂无离线音乐缓存'}</li>
    {/each}
  </ul>
</AccordionCard>

<style>
  .cache-stat-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--stat-bar-bg);
    border: 1px solid var(--border-subtle);
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 13px;
  }

  .stat-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .stat-info {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .stat-divider {
    color: var(--text-muted);
    opacity: 0.6;
  }

  .auto-cache-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: var(--btn-secondary-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
  }

  .auto-cache-toggle input[type="checkbox"] {
    cursor: pointer;
    accent-color: var(--primary, #3b82f6);
  }

  .stat-actions-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cache-action-btn {
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 6px;
  }

  .btn-danger {
    color: #ef4444;
  }

  .clean-low-control {
    display: inline-flex;
    align-items: center;
    background: var(--btn-secondary-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    overflow: hidden;
  }

  .clean-low-btn {
    padding: 4px 8px;
    font-size: 12px;
    border: none;
    border-radius: 0;
    background: transparent;
    cursor: pointer;
    color: var(--text-primary);
  }

  .clean-low-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .clean-n-input {
    width: 30px;
    height: 22px;
    padding: 0 2px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    background: var(--input-bg, rgba(0, 0, 0, 0.2));
    color: var(--text-primary);
    margin: 0 2px;
  }

  .clean-unit-text {
    font-size: 11px;
    color: var(--text-secondary);
    padding-right: 6px;
  }

  .cache-sort-hint-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--tag-bg, rgba(255, 255, 255, 0.03));
    border: 1px dashed var(--border-subtle);
    padding: 5px 10px;
    border-radius: 6px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .hint-text-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint-icon {
    font-size: 12px;
  }

  .hint-label {
    color: var(--text-secondary);
  }

  .hint-badge {
    color: var(--text-muted);
    font-size: 11px;
    flex-shrink: 0;
  }

  .play-count-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 5px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 4px;
    background: rgba(59, 130, 246, 0.12);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.25);
  }

  .cache-time-tag {
    opacity: 0.8;
  }
</style>
