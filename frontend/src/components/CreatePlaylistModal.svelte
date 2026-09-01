<script lang="ts">
  import { api } from '../lib/api';
  import Modal from './Modal.svelte';

  let { onClose, onSuccess } = $props<{ onClose: () => void; onSuccess: (id?: string) => void }>();
  let name = $state('');
  let isPrivate = $state(false);
  let loading = $state(false);

  async function submit() {
    if (!name.trim()) return;
    loading = true;
    try {
      const j = await api.playlistCreate(name.trim(), isPrivate);
      if (j.code === '000000') {
        onSuccess(j.data?.id);
        onClose();
      } else {
        alert(j.msg);
      }
    } catch (e) {
      alert('创建失败:' + e);
    }
    loading = false;
  }
</script>

<Modal title="新建自建歌单" icon="➕" maxWidth="max-w-[500px]" {onClose}>
  <div class="mb-4">
    <div class="text-xs text-[var(--text-secondary,#94a3b8)] mb-1.5 font-medium">歌单名称：</div>
    <input
      type="text"
      placeholder="输入歌单名称"
      bind:value={name}
      onkeydown={(e) => e.key === 'Enter' && submit()}
      class="w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[var(--text-main)] text-sm focus:outline-none focus:border-blue-500 transition-all"
    />
  </div>
  <label class="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary,#cbd5e1)] select-none">
    <input
      type="checkbox"
      checked={isPrivate}
      onchange={(e) => isPrivate = (e.target as HTMLInputElement).checked}
      class="w-4 h-4 rounded accent-blue-500 cursor-pointer"
    />
    设置为隐私歌单（仅自己可见）
  </label>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
    >
      取消
    </button>
    <button
      type="button"
      onclick={submit}
      disabled={loading || !name.trim()}
      class="btn-primary text-xs px-4.5 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? '创建中...' : '立即创建'}
    </button>
  {/snippet}
</Modal>
