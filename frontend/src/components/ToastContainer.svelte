<script lang="ts">
  import { toastState } from '../lib/toast.svelte';

  let { toasts } = $props<{
    toasts?: { id: number; msg: string; type: string }[];
  }>();

  let activeToasts = $derived(toasts !== undefined ? toasts : toastState.toasts);
</script>

<div
  id="globalToastContainer"
  class="fixed top-[calc(16px+env(safe-area-inset-top,0px))] right-[calc(16px+env(safe-area-inset-right,0px))] z-[100000] flex flex-col items-end gap-2 pointer-events-none max-w-[min(420px,90vw)]"
>
  {#each activeToasts as t (t.id)}
    <div
      class="pointer-events-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-white shadow-xl backdrop-blur-md max-w-[360px] animate-[toast-fade-in_0.3s_cubic-bezier(0.16,1,0.3,1)] {t.type === 'error' ? 'bg-red-500/95 shadow-red-500/25' : t.type === 'success' ? 'bg-emerald-500/95 shadow-emerald-500/25' : t.type === 'warning' ? 'bg-amber-500/95 shadow-amber-500/25' : 'bg-slate-800/95 shadow-black/30'}"
    >
      {t.msg}
    </div>
  {/each}
</div>
