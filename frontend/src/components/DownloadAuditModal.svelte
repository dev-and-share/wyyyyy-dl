<script lang="ts">
  import Modal from './Modal.svelte';
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
</script>

{#if modalType}
  <Modal
    title="{modalType === 'missing' ? t('download.modalTitleMissing') : t('download.modalTitleNonMp3')} ({modalList.length})"
    maxWidth="max-w-[580px]"
    {onClose}
  >
    {#if modalLoading}
      <div class="py-5 text-center text-[var(--text-muted)] text-xs">{t('download.loadingList')}</div>
    {:else if modalList.length > 0}
      <div class="text-xs text-[var(--text-secondary)] mb-2">
        {modalType === 'missing' ? t('download.missingNotice') : t('download.nonMp3Notice')}
      </div>
      <ul class="max-h-60 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-[var(--border-subtle)] rounded-xl p-0 m-0 list-none text-xs">
        {#each modalList as it}
          <li class="py-1.5 px-3 flex justify-between items-center gap-2">
            <span class="truncate font-medium">{it.songName || it.name}</span>
            <span class="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">{it.filePath || it.format || ''}</span>
          </li>
        {/each}
      </ul>
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
