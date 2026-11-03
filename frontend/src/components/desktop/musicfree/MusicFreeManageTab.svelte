<script lang="ts">
  import { musicFreeStore } from '../../../lib/musicfree/musicFreeStore.svelte';

  let {
    showToast
  } = $props<{
    showToast: (m: string, t?: string) => void;
  }>();

  let inputUrl = $state('');

  const PRESET_SOURCES = [
    {
      name: '🌟 纯净主流五大源 (高品质推荐)',
      url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/myPlugins.json'
    },
    {
      name: '🌐 全网每日自动同步源 (Cloudflare)',
      url: 'https://musicfreepluginshub.pages.dev/plugins.json'
    },
    {
      name: '📻 官方基础扩展源 (Gitee)',
      url: 'https://gitee.com/maotoumao/MusicFreePlugins/raw/master/plugins.json'
    }
  ];

  const SINGLE_PRESETS = [
    { name: '酷我音乐 (小蜗)', url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaowo.js' },
    { name: 'QQ音乐 (小秋)', url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaoqiu.js' },
    { name: '酷狗音乐 (小枸)', url: 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaogou.js' },
    { name: '猫耳FM (广播剧)', url: 'https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/maoerfm/index.js' },
    { name: 'B站音乐 (Bilibili)', url: 'https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/bilibili/index.js' }
  ];

  function handleCleanupJunk() {
    const count = musicFreeStore.cleanupJunkPlugins();
    if (count > 0) {
      showToast(`已为您成功清理 ${count} 个无歌单或失效垃圾插件！`, 'success');
    } else {
      showToast('当前已安装插件中未检测到已知失效垃圾源', 'info');
    }
  }

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
</script>

<div class="space-y-6">
  <!-- 导入订阅源 / 单插件卡片 -->
  <section class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
    <h2 class="text-sm font-semibold text-[var(--text-main)] flex items-center gap-1.5">
      <span>📥</span> 导入音源插件或订阅源
    </h2>

    <div class="flex flex-col sm:flex-row gap-2.5">
      <input
        type="text"
        bind:value={inputUrl}
        placeholder="粘贴 plugins.json 订阅源地址或单个 .js 插件地址..."
        class="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-xs lg:text-sm text-[var(--text-main)] outline-none focus:border-purple-500 transition-colors"
        onkeydown={(e) => e.key === 'Enter' && handleImport()}
      />
      <button
        type="button"
        disabled={musicFreeStore.loading}
        onclick={() => handleImport()}
        class="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-xs lg:text-sm hover:bg-purple-500 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
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
    <div class="pt-2 border-t border-[var(--border-color)]/50 space-y-2">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs text-[var(--text-muted)] font-medium">高品质订阅源：</span>
        {#each PRESET_SOURCES as preset}
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg text-[11px] bg-[var(--btn-secondary-bg)] hover:bg-purple-500/10 hover:text-purple-400 text-[var(--text-secondary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            onclick={() => {
              inputUrl = preset.url;
              handleImport(preset.url);
            }}
          >
            {preset.name}
          </button>
        {/each}
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs text-[var(--text-muted)] font-medium">单平台精选：</span>
        {#each SINGLE_PRESETS as single}
          <button
            type="button"
            class="px-2 py-0.5 rounded-md text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 transition-colors cursor-pointer"
            onclick={() => {
              inputUrl = single.url;
              handleImport(single.url);
            }}
          >
            + {single.name}
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
      <div class="flex items-center gap-2">
        {#if musicFreeStore.plugins.length > 0}
          <button
            type="button"
            onclick={handleCleanupJunk}
            class="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
            title="剔除歌曲宝、书音FM、6yueting等无歌单数据的死源"
          >
            🧹 一键清理失效垃圾源
          </button>
        {/if}
        <span class="text-xs text-[var(--text-muted)] hidden sm:inline">
          支持单独启用或禁用音源
        </span>
      </div>
    </div>

    {#if musicFreeStore.plugins.length === 0}
      <div class="p-8 text-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--card-bg)]/40 text-[var(--text-muted)] text-xs sm:text-sm">
        暂未导入任何音源插件。点击上方预设即可一键加载！
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {#each musicFreeStore.plugins as plugin (plugin.id)}
          <div class="p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-xs flex flex-col justify-between hover:border-purple-500/40 transition-all">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs sm:text-sm text-[var(--text-main)] truncate max-w-[140px]" title={plugin.name}>
                  {plugin.name}
                </span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--btn-secondary-bg)] text-[var(--text-muted)] font-mono">
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
                  class="rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
                <span class="text-xs {plugin.enabled ? 'text-emerald-500 font-medium' : 'text-[var(--text-muted)]'}">
                  {plugin.enabled ? '已启用' : '已停用'}
                </span>
              </label>

              <button
                type="button"
                onclick={() => musicFreeStore.removePlugin(plugin.id)}
                class="text-[11px] text-red-400 hover:text-red-300 p-1 cursor-pointer bg-transparent border-none"
                title="移除该插件"
              >
                删除
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
