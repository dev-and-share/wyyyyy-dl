<script lang="ts">
  import { toastState, type ToastItem } from '../lib/toast.svelte';

  let { toasts } = $props<{
    toasts?: ToastItem[];
  }>();

  let activeToasts = $derived(toasts !== undefined ? toasts : toastState.toasts);
</script>

<div
  id="globalToastContainer"
  class="fixed top-[calc(16px+env(safe-area-inset-top,0px))] right-[calc(16px+env(safe-area-inset-right,0px))] z-[110000] flex flex-col items-end gap-2 pointer-events-none max-w-[min(480px,92vw)]"
>
  {#each activeToasts as t (t.id)}
    <div
      class="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-xl backdrop-blur-md max-w-[460px] animate-[toast-fade-in_0.3s_cubic-bezier(0.16,1,0.3,1)] {t.type === 'error' ? 'bg-red-500/95 shadow-red-500/25' : t.type === 'success' ? 'bg-emerald-500/95 shadow-emerald-500/25' : t.type === 'warning' ? 'bg-amber-500/95 shadow-amber-500/25' : 'bg-slate-800/95 shadow-black/30'}"
    >
      <span class="truncate">{t.msg}</span>
      {#if t.action}
        <button
          type="button"
          class="ml-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/35 active:scale-95 text-white font-bold text-[11px] cursor-pointer border-none shrink-0 transition-all shadow-xs"
          onclick={(e) => {
            e.stopPropagation();
            t.action?.onClick();
          }}
        >
          {t.action.label}
        </button>
      {/if}
    </div>
  {/each}
</div>
