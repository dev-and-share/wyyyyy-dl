<script lang="ts">
  let { status } = $props<{ status: string }>();

  let s = $derived(String(status).toUpperCase());
  let badgeClass = $derived(
    s === 'SUCCESS' ? 'bg-emerald-500' :
    s === 'DOWNLOADING' ? 'bg-amber-500 animate-[pulse-ring_1s_infinite_alternate]' :
    s === 'FAILED' ? 'bg-red-500' :
    s === 'SKIP' ? 'bg-slate-500' :
    'bg-slate-400'
  );
</script>

<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white inline-block uppercase tracking-wider {badgeClass}">
  {status}
</span>
