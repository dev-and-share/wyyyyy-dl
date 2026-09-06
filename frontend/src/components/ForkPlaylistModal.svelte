<script lang="ts">
  import { api } from '../lib/api';
  import Modal from './Modal.svelte';

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
    name = playlistName || '我的转存歌单';
  });

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('请输入歌单名称', 'warning');
      return;
    }
    if (!trackIds.length) {
      showToast('暂无可转存的歌曲', 'warning');
      return;
    }

    loading = true;
    showToast(`正在转存 ${trackIds.length} 首歌曲到新自建歌单...`, 'info', 3000);
    try {
      const res = await api.playlistFork(trimmed, isPrivate, trackIds.map(String).join(','));
      if (res?.code && res.code !== '000000') {
        showToast(res.msg || '转存失败', 'error');
        loading = false;
        return;
      }
      const newPl = res.data;
      const newId = String(newPl?.id || '');
      showToast(`🎉 成功转存 ${trackIds.length} 首歌曲至自建歌单「${trimmed}」！`, 'success', 4000);

      // 触发全站事件刷新左侧/我的歌单列表
      window.dispatchEvent(new CustomEvent('wyyyy:playlist-created'));

      if (onSuccess) {
        onSuccess(newId, trimmed);
      }
      onClose();
    } catch (e: any) {
      showToast('转存歌单异常: ' + (e?.message || e), 'error');
    } finally {
      loading = false;
    }
  }
</script>

<Modal title="转存为自建歌单" icon="📦" maxWidth="max-w-[500px]" {onClose}>
  <div class="flex flex-col gap-4 text-xs leading-relaxed text-[var(--text-secondary)]">
    <div class="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
      💡 <strong>说明</strong>：将为您在网易云新建专属于您的自建歌单，并自动将 <strong class="text-white font-bold">{trackCount || trackIds.length}</strong> 首歌曲批量导入其中。绕过官方对第三方客户端收藏他人歌单的风控限制。
    </div>

    <div>
      <label for="fork-playlist-name" class="block text-xs text-[var(--text-muted)] mb-1.5 font-medium">新歌单名称：</label>
      <input
        id="fork-playlist-name"
        type="text"
        placeholder="输入新歌单名称"
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
      <span>设置为隐私歌单（仅自己可见）</span>
    </label>
  </div>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
    >
      取消
    </button>
    <button
      type="button"
      onclick={submit}
      disabled={loading || !name.trim()}
      class="btn-primary !bg-gradient-to-r !from-purple-600 !to-indigo-600 text-xs px-4.5 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-500/20 cursor-pointer"
    >
      {loading ? '转存中...' : `确认转存 (${trackCount || trackIds.length} 首)`}
    </button>
  {/snippet}
</Modal>
