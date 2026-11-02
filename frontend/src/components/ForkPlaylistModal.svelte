<script lang="ts">
  import { api } from '../lib/api';
  import Modal from './Modal.svelte';
  import { t } from '../lib/i18n/index.svelte';

  let {
    playlistName = '',
    trackCount = 0,
    trackIds = [],
    onClose,
    onSuccess,
    showToast
  } = $props<{
    playlistName: string;
    trackCount: number;
    trackIds: (string | number)[];
    onClose: () => void;
    onSuccess?: (newPlaylistId: string, newPlaylistName: string) => void;
    showToast: (m: string, t?: string) => void;
  }>();

  let name = $state('');
  let isPrivate = $state(false);
  let loading = $state(false);

  $effect(() => {
    name = playlistName || t('playlist.defaultForkName');
  });

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast(t('playlist.enterNamePrompt'), 'warning');
      return;
    }
    if (!trackIds.length) {
      showToast(t('playlist.noTracksToFork'), 'warning');
      return;
    }

    loading = true;
    showToast(t('playlist.forkingTracksNotice', { count: trackIds.length }), 'info', 3000);
    try {
      const res = await api.playlistFork(trimmed, isPrivate, trackIds.map(String).join(','));
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || t('playlist.forkFailed'), 'error');
        loading = false;
        return;
      }
      const newPl = res.data;
      const newId = String(newPl?.id || '');
      showToast(t('playlist.forkSuccess', { count: trackIds.length, name: trimmed }), 'success', 4000);

      // notify playlist created
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));

      if (onSuccess) {
        onSuccess(newId, trimmed);
      }
      onClose();
    } catch (e: any) {
      showToast(t('playlist.forkException', { error: e?.message || e }), 'error');
    } finally {
      loading = false;
    }
  }
</script>

<Modal title={t('playlist.forkTitle')} icon="📦" maxWidth="max-w-[500px]" {onClose}>
  <div class="flex flex-col gap-4 text-xs leading-relaxed text-[var(--text-secondary)]">
    <div class="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
      💡 <strong>{t('common.notice')}</strong>：{t('playlist.forkNotice', { count: trackCount || trackIds.length })}
    </div>

    <div>
      <label for="fork-playlist-name" class="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">{t('playlist.forkNameLabel')}</label>
      <input
        id="fork-playlist-name"
        type="text"
        placeholder={t('playlist.forkNamePlaceholder')}
        bind:value={name}
        onkeydown={(e) => e.key === 'Enter' && submit()}
        class="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-main)] text-sm focus:outline-none focus:border-purple-500 transition-all"
      />
    </div>

    <label class="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)] select-none">
      <input
        type="checkbox"
        checked={isPrivate}
        onchange={(e) => isPrivate = (e.target as HTMLInputElement).checked}
        class="w-4 h-4 rounded accent-purple-500 cursor-pointer"
      />
      <span>{t('playlist.privacyLabel')}</span>
    </label>
  </div>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
    >
      {t('common.cancel')}
    </button>
    <button
      type="button"
      onclick={submit}
      disabled={loading || !name.trim()}
      class="btn-primary !bg-gradient-to-r !from-purple-600 !to-indigo-600 text-xs px-4.5 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-500/20 cursor-pointer"
    >
      {loading ? t('playlist.forking') : t('playlist.forkAction', { count: trackCount || trackIds.length })}
    </button>
  {/snippet}
</Modal>
