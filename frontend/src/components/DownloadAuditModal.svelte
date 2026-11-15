<script lang="ts">
  import Modal from './Modal.svelte';
  import { Copy, Check, ChevronDown, ChevronUp } from '@lucide/svelte';
  import { t } from '../lib/i18n';

  let {
    modalType = null,
    modalList = [],
    modalLoading = false,
    onClose,
    onCleanMissing,
    onCleanNonMp3
  } = $props<{
    modalType: 'missing' | 'nonMp3' | null;
    modalList: any[];
    modalLoading: boolean;
    onClose: () => void;
    onCleanMissing: () => void;
    onCleanNonMp3: () => void;
  }>();

  let searchKw = $state('');
  let copiedId = $state<string | number | null>(null);
  let copyTimer: any = null;
  let expandedId = $state<string | number | null>(null);

  let filteredList = $derived(
    modalList.filter((it: any) => {
      if (!searchKw.trim()) return true;
      const kw = searchKw.toLowerCase();
      const name = (it.songName || it.name || '').toLowerCase();
      const path = (it.filePath || it.path || '').toLowerCase();
      const format = (it.format || '').toLowerCase();
      return name.includes(kw) || path.includes(kw) || format.includes(kw);
    })
  );

  async function handleCopyPath(path: string, id: string | number, e?: MouseEvent) {
    if (e) e.stopPropagation();
    if (!path) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(path);
      }
      copiedId = id;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copiedId = null;
      }, 1500);
    } catch {
      // fallback
    }
  }

  function toggleExpand(id: string | number) {
    expandedId = expandedId === id ? null : id;
  }
</script>

{#if modalType}
  <Modal
    title="{modalType === 'missing' ? t('download.modalTitleMissing') : t('download.modalTitleNonMp3')} ({modalList.length})"
    maxWidth="max-w-[760px]"
    {onClose}
  >
    {#if modalLoading}
      <div class="py-8 text-center text-[var(--text-muted)] text-xs">{t('download.loadingList')}</div>
    {:else if modalList.length > 0}
      <div class="flex flex-col gap-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <span>{modalType === 'missing' ? t('download.missingNotice') : t('download.nonMp3Notice')}</span>
          <span class="text-[11px] text-[var(--text-muted)]">💡 悬浮看全路径 · 点击可复制/展开</span>
        </div>

        {#if modalList.length > 8}
          <div class="relative">
            <input
              type="text"
              bind:value={searchKw}
              placeholder="快速过滤歌曲名或路径..."
              class="w-full px-3 py-1.5 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] text-[var(--text-main)] outline-none focus:border-red-500/50"
            />
            {#if searchKw}
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] border-none bg-transparent cursor-pointer"
                onclick={() => searchKw = ''}
              >
                ✕
              </button>
            {/if}
          </div>
        {/if}

        <ul class="max-h-[50vh] sm:max-h-[380px] overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-[var(--border-subtle)] rounded-xl p-1 m-0 list-none text-xs custom-scroll">
          {#each filteredList as it, idx (it.id || idx)}
            {@const itemId = it.id || idx}
            {@const songTitle = it.songName || it.name || t('common.unknownSong')}
            {@const fullPath = it.filePath || it.path || ''}
            {@const format = it.format || (fullPath ? fullPath.split('.').pop() : '')}
            {@const isExpanded = expandedId === itemId}
            <li class="rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <div
                class="py-2 px-2.5 flex justify-between items-center gap-2 cursor-pointer group"
                role="button"
                tabindex="0"
                onclick={() => toggleExpand(itemId)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(itemId); } }}
                title={isExpanded ? '点击收起' : '点击展开查看完整路径与详情'}
              >
                <!-- 左侧：序号 + 歌名 + 格式 Badge -->
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <span class="text-[10px] text-[var(--text-muted)] font-mono w-5 shrink-0 text-right">{idx + 1}.</span>
                  <span class="truncate font-semibold text-[var(--text-main)] text-xs" title={songTitle}>
                    {songTitle}
                  </span>
                  {#if format}
                    <span class="text-[9px] font-mono px-1 py-0.2 rounded uppercase font-bold shrink-0 {format.toLowerCase() === 'flac' || format.toLowerCase() === 'wav' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'}">
                      .{format.toLowerCase()}
                    </span>
                  {/if}
                </div>

                <!-- 右侧：文件物理路径 -->
                {#if fullPath}
                  <div class="flex items-center gap-1.5 max-w-[55%] sm:max-w-[65%] shrink-0 justify-end min-w-0">
                    <button
                      type="button"
                      class="p-0 border-none bg-transparent cursor-pointer text-[11px] font-mono text-[var(--text-muted)] hover:text-amber-500 dark:hover:text-amber-400 truncate text-right transition-colors inline-flex items-center gap-1 max-w-full"
                      title={`完整路径：${fullPath}\n（点击直接复制）`}
                      onclick={(e) => handleCopyPath(fullPath, itemId, e)}
                    >
                      <span class="truncate">{fullPath}</span>
                      {#if copiedId === itemId}
                        <span class="text-[10px] text-emerald-500 font-sans shrink-0 font-medium bg-emerald-500/15 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                          <Check size={10} /> {t('common.copied')}
                        </span>
                      {:else}
                        <Copy size={11} class="opacity-0 group-hover:opacity-70 transition-opacity shrink-0" />
                      {/if}
                    </button>
                    <span class="text-[var(--text-muted)] opacity-40 group-hover:opacity-80 transition-opacity shrink-0">
                      {#if isExpanded}
                        <ChevronUp size={12} />
                      {:else}
                        <ChevronDown size={12} />
                      {/if}
                    </span>
                  </div>
                {:else if it.format}
                  <span class="text-[11px] text-[var(--text-muted)] font-mono uppercase">.{it.format}</span>
                {/if}
              </div>

              <!-- 展开显示完整长路径与操作 -->
              {#if isExpanded && fullPath}
                <div class="mx-2 mb-2 p-2 border-t border-[var(--border-subtle)] flex flex-col gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg">
                  <div class="text-[10px] text-[var(--text-muted)] font-medium flex items-center justify-between">
                    <span>物理文件完整路径:</span>
                    <button
                      type="button"
                      class="btn-secondary px-2 py-0.5 text-[10px] rounded inline-flex items-center gap-1 cursor-pointer"
                      onclick={(e) => handleCopyPath(fullPath, itemId, e)}
                    >
                      <Copy size={10} />
                      <span>{copiedId === itemId ? t('common.copied') : t('common.copy')}</span>
                    </button>
                  </div>
                  <div class="font-mono text-[11px] text-[var(--text-secondary)] break-all select-all bg-black/5 dark:bg-white/5 p-1.5 rounded border border-[var(--border-subtle)] leading-relaxed">
                    {fullPath}
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <div class="py-8 text-center text-emerald-500 font-medium text-xs">{t('download.noAbnormalRecords')}</div>
    {/if}

    {#snippet footer()}
      <div class="flex justify-between items-center w-full gap-2">
        {#if modalType === 'missing' && modalList.length > 0}
          <button class="btn-secondary text-xs text-red-400" onclick={onCleanMissing}>{t('download.cleanAllMissingBtn')}</button>
        {:else if modalType === 'nonMp3' && modalList.length > 0}
          <button class="btn-secondary text-xs text-amber-400" onclick={onCleanNonMp3}>{t('download.cleanAllNonMp3Btn')}</button>
        {:else}
          <span></span>
        {/if}
        <button class="btn-secondary text-xs" onclick={onClose}>{t('common.close')}</button>
      </div>
    {/snippet}
  </Modal>
{/if}

<style>
  .custom-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scroll::-webkit-scrollbar-thumb {
    background: var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
  }
</style>
