<script lang="ts">
  import { musicFreeStore } from '../../lib/musicfree/musicFreeStore.svelte';
  import { musicFreeAdapter } from '../../lib/adapters/musicFreeAdapter';
  import type { Track } from '../../lib/types';
  import { DEFAULT_VINYL_COVER } from '../../lib/utils';
  import { t } from '../../lib/i18n';

  let {
    curTrack = null,
    playing = false,
    onPlayQueue,
    showToast
  } = $props<{
    curTrack?: Track | null;
    playing?: boolean;
    onPlayQueue?: (tracks: any[], idx?: number) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let inputUrl = $state('');
  let searchKeyword = $state('');
  let isSearching = $state(false);
  let searchResults = $state<any[]>([]);
  let searchErrors = $state<string[]>([]);

  // 预设接口列表（方便一键点击快速测试）
  const PRESET_SOURCES = [
    {
      name: '测试接口 (Gitee)',
      url: 'https://gitee.com/maotoumao/MusicFreePlugins/raw/master/plugins.json'
    },
    {
      name: '综合接口一 (JsDelivr 推荐)',
      url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/myPlugins.json'
    },
    {
      name: '综合接口零',
      url: 'https://musicfreepluginshub.2020818.xyz/plugins.json'
    },
    {
      name: '综合接口四 (GitLab)',
      url: 'https://gitlab.com/acoolbook/musicfree/-/raw/main/music.json'
    }
  ];

  async function handleImport(urlToImport?: string) {
    const url = (urlToImport || inputUrl).trim();
    if (!url) {
      showToast('请输入有效的 MusicFree 插件或订阅源地址', 'warning');
      return;
    }

    try {
      showToast('正在解析并加载插件...', 'info', 3000);
      const res = await musicFreeStore.installFromUrl(url);
      if (res.successCount > 0) {
        showToast(`🎉 成功导入并激活 ${res.successCount} 个音源插件！`, 'success');
        inputUrl = '';
      } else {
        showToast('未能导入任何插件，请检查网络或链接是否有效', 'error');
      }
      if (res.errors.length > 0) {
        console.warn('插件导入过程部分异常:', res.errors);
      }
    } catch (err: any) {
      showToast(`导入失败: ${err.message || err}`, 'error');
    }
  }

  async function handleTestSearch() {
    const kw = searchKeyword.trim();
    if (!kw) return;

    isSearching = true;
    searchErrors = [];
    searchResults = [];

    try {
      const { results, errors } = await musicFreeStore.searchAll(kw, 1);
      searchResults = results;
      searchErrors = errors;
      if (results.length === 0) {
        showToast('未能搜索到曲目，请检查是否已启用相关音源插件', 'warning');
      } else {
        showToast(`全网聚合搜索到 ${results.length} 首曲目`, 'success');
      }
    } catch (err: any) {
      showToast(`搜索失败: ${err.message || err}`, 'error');
    } finally {
      isSearching = false;
    }
  }

  function handlePlayTrack(item: any) {
    const track = musicFreeAdapter.normalizeTrack(item);
    if (onPlayQueue) {
      onPlayQueue([track], 0);
      showToast(`开始播放: ${track.name} - ${track.artist}`, 'info');
    }
  }
</script>

<div class="w-full h-full flex flex-col p-4 lg:p-6 overflow-y-auto max-w-7xl mx-auto space-y-6">
  <!-- 标题与介绍 -->
  <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4 shrink-0">
    <div>
      <h1 class="text-xl lg:text-2xl font-bold flex items-center gap-2.5 text-[var(--text-main)]">
        <span class="text-2xl">🧩</span> MusicFree 音源插件工作台
      </h1>
      <p class="text-xs lg:text-sm text-[var(--text-secondary)] mt-1">
        无须下载客户端，原版 MusicFree 插件在浏览器原地执行，依托 Spring Boot 盲代理突破音源边界与防盗链。
      </p>
    </div>
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        已就绪 {musicFreeStore.getActivePlugins().length} / 共 {musicFreeStore.plugins.length} 个音源
      </span>
    </div>
  </header>

  <!-- 导入订阅源 / 单插件卡片 -->
  <section class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
    <h2 class="text-sm font-semibold text-[var(--text-main)] flex items-center gap-1.5">
      <span>📥</span> 导入音源插件或订阅源
    </h2>

    <div class="flex flex-col sm:flex-row gap-2.5">
      <input
        type="text"
        bind:value={inputUrl}
        placeholder="粘贴 plugins.json 订阅源地址或单个 .js 插件地址..."
        class="flex-1 px-3.5 py-2.5 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-xs lg:text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)] transition-colors"
        onkeydown={(e) => e.key === 'Enter' && handleImport()}
      />
      <button
        type="button"
        disabled={musicFreeStore.loading}
        onclick={() => handleImport()}
        class="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium text-xs lg:text-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
      >
        {#if musicFreeStore.loading}
          <span class="animate-spin text-sm">⏳</span>
          <span>{musicFreeStore.statusMessage || '拉取解析中...'}</span>
        {:else}
          <span>一键导入</span>
        {/if}
      </button>
    </div>

    <!-- 预设接口快捷点击标签 -->
    <div class="pt-2 border-t border-[var(--border-color)]/50">
      <span class="text-xs text-[var(--text-muted)] mr-2 font-medium">快速测试预设：</span>
      <div class="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
        {#each PRESET_SOURCES as preset}
          <button
            type="button"
            class="px-2.5 py-1 rounded-md text-[11px] bg-[var(--btn-secondary-bg)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            onclick={() => {
              inputUrl = preset.url;
              handleImport(preset.url);
            }}
          >
            {preset.name}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <!-- 已安装插件网格列表 -->
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-[var(--text-main)] flex items-center gap-1.5">
        <span>📦</span> 已安装音源插件 ({musicFreeStore.plugins.length})
      </h2>
    </div>

    {#if musicFreeStore.plugins.length === 0}
      <div class="p-8 text-center border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--card-bg)]/40 text-[var(--text-muted)] text-xs sm:text-sm">
        暂未导入任何音源插件。点击上方预设（如“综合接口一”）即可一键加载小秋、小蜗、小枸等主流音源！
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {#each musicFreeStore.plugins as plugin (plugin.id)}
          <div class="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xs flex flex-col justify-between hover:border-[var(--primary)]/40 transition-all">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs sm:text-sm text-[var(--text-main)] truncate max-w-[140px]" title={plugin.name}>
                  {plugin.name}
                </span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--btn-secondary-bg)] text-[var(--text-muted)] font-mono">
                  v{plugin.version}
                </span>
              </div>
              <p class="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                作者：{plugin.author || '网络开源'}
              </p>
              {#if plugin.error}
                <p class="text-[10px] text-red-500 line-clamp-1" title={plugin.error}>
                  ⚠️ 异常: {plugin.error}
                </p>
              {/if}
            </div>

            <div class="mt-3 pt-2.5 border-t border-[var(--border-color)]/60 flex items-center justify-between">
              <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={plugin.enabled}
                  onchange={() => musicFreeStore.togglePlugin(plugin.id)}
                  class="rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
                <span class="text-xs {plugin.enabled ? 'text-emerald-500 font-medium' : 'text-[var(--text-muted)]'}">
                  {plugin.enabled ? '已启用' : '已停用'}
                </span>
              </label>

              <button
                type="button"
                onclick={() => musicFreeStore.removePlugin(plugin.id)}
                class="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors p-1"
                title="删除插件"
              >
                🗑️
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- 聚合音源联调测试区 -->
  <section class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-[var(--text-main)] flex items-center gap-1.5">
        <span>🔍</span> 音源联调即时测试 (多平台聚合搜索与试听)
      </h2>
      {#if searchErrors.length > 0}
        <span class="text-[11px] text-amber-500 font-medium">
          {searchErrors.length} 个音源有报错 (已自动跳过)
        </span>
      {/if}
    </div>

    <div class="flex gap-2">
      <input
        type="text"
        bind:value={searchKeyword}
        placeholder="搜索任意歌曲或歌手测试音源 (如: 晴天, 周杰伦, 富士山下)..."
        class="flex-1 px-3.5 py-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-xs sm:text-sm text-[var(--text-main)] outline-none focus:border-[var(--primary)] transition-colors"
        onkeydown={(e) => e.key === 'Enter' && handleTestSearch()}
      />
      <button
        type="button"
        disabled={isSearching}
        onclick={handleTestSearch}
        class="px-4 py-2 rounded-lg bg-[var(--btn-secondary-bg)] hover:bg-[var(--primary)] hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
      >
        {isSearching ? '检索中...' : '聚合搜索'}
      </button>
    </div>

    <!-- 搜索结果列表 -->
    {#if searchResults.length > 0}
      <div class="divide-y divide-[var(--border-color)]/60 max-h-[380px] overflow-y-auto pr-1">
        {#each searchResults as item, idx}
          {@const isPlayingThis = curTrack && curTrack.name === (item.title || item.name) && playing}
          <div class="py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--btn-secondary-bg)]/40 px-2 rounded-lg transition-colors">
            <div class="flex items-center gap-3 min-w-0">
              <img
                src={item.artwork || item.pic || DEFAULT_VINYL_COVER}
                alt=""
                class="w-10 h-10 rounded-md object-cover bg-black/10 shrink-0"
                loading="lazy"
              />
              <div class="min-w-0">
                <div class="text-xs sm:text-sm font-medium text-[var(--text-main)] truncate">
                  {item.title || item.name}
                </div>
                <div class="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1.5 mt-0.5">
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
                    {item._pluginPlatform || '第三方'}
                  </span>
                  <span class="truncate">{item.artist || '未知'} · {item.album || '单曲'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onclick={() => handlePlayTrack(item)}
              class="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-all {isPlayingThis ? 'bg-emerald-500 text-white' : 'bg-[var(--primary)] text-white hover:opacity-90'}"
            >
              {isPlayingThis ? '▶ 播放中' : '▶ 试听'}
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
