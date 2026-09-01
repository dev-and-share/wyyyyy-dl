<script lang="ts">
  import { INITIAL_BANDS, BUILTIN_PRESETS, type Band } from '../lib/peq';

  let { onClose } = $props<{ onClose: () => void }>();
  let enabled = $state(true);
  let bands = $state<Band[]>(JSON.parse(JSON.stringify(INITIAL_BANDS)));
  let preset = $state('flat');

  function applyPreset(v: string) {
    preset = v;
    const target = BUILTIN_PRESETS[v];
    if (target && target.bands) {
      bands = bands.map((b, i) => ({
        ...b,
        gain: target.bands[i]?.gain ?? 0,
        q: target.bands[i]?.q ?? b.q
      }));
    }
  }

  function reset() {
    applyPreset('flat');
  }

  let canvas: HTMLCanvasElement;
  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = (canvas.width = canvas.clientWidth * 2);
    const h = (canvas.height = 120 * 2);
    ctx.clearRect(0, 0, w, h);

    // 获取当前是否白天模式
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.strokeStyle = isLight ? 'rgba(16, 185, 129, 0.25)' : 'rgba(74, 222, 128, 0.3)';
    ctx.lineWidth = 1;

    // grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // curve
    ctx.strokeStyle = isLight ? '#059669' : '#4ade80';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    const step = w / 40;
    for (let i = 0; i <= 40; i++) {
      const x = i * step;
      let y = h / 2;
      bands.forEach((b) => {
        const idx = (Math.log2(b.freq / 60) / Math.log2(14000 / 60)) * 40;
        const dist = Math.abs(i - idx);
        const gain = b.gain * 10;
        y -= gain * Math.exp((-dist * dist) / 20);
      });
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- 🎛️ 5 段参量均衡器统一抽屉 (支持全套白天/黑夜主题 + 移动端底部滑出 Bottom Sheet) -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 bg-black/45 backdrop-blur-sm z-[10002] flex justify-end items-end box-border animate-[modalFadeIn_0.2s_ease-out]"
  onclick={onClose}
>
  <div
    class="mr-5 mb-[75px] w-[680px] max-w-[calc(100vw-30px)] max-h-[calc(100vh-100px)] rounded-2xl bg-[var(--card-bg-solid,#111827)]/95 backdrop-blur-2xl border border-[var(--border-color,rgba(255,255,255,0.12))] shadow-2xl p-5 overflow-y-auto text-[var(--text-main)] box-border max-md:mr-0 max-md:mb-0 max-md:w-full max-md:rounded-b-none max-md:rounded-t-[20px] max-md:max-h-[85vh] max-md:pb-[calc(16px+env(safe-area-inset-bottom,0px))] animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- 头部栏 -->
    <div class="flex justify-between items-center mb-3">
      <div class="flex items-center gap-2">
        <span class="text-lg">🎛️</span>
        <h3 class="m-0 text-base font-bold text-[var(--text-main)]">5 段参量均衡器 (PEQ)</h3>
      </div>
      <button
        type="button"
        class="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        onclick={onClose}
        title="关闭均衡器"
      >
        ✕
      </button>
    </div>

    <!-- 预设与启用开关栏 -->
    <div class="flex flex-col gap-2 mb-3 bg-black/5 dark:bg-white/[0.03] p-3 rounded-xl border border-black/5 dark:border-white/5">
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[var(--text-main)] select-none">
          <input
            type="checkbox"
            checked={enabled}
            onchange={(e) => (enabled = (e.target as HTMLInputElement).checked)}
            class="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
          />
          <span>⚡ 启用</span>
        </label>

        <select
          class="px-2.5 py-1 text-xs rounded-lg bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[var(--text-main)] focus:outline-none focus:border-emerald-500 cursor-pointer"
          value={preset}
          onchange={(e) => applyPreset((e.target as HTMLSelectElement).value)}
        >
          {#each Object.entries(BUILTIN_PRESETS) as [k, item]}
            <option value={k}>{item.name}</option>
          {/each}
        </select>

        <span class="text-[11px] text-[var(--text-muted)] ml-auto">5段频率/增益/Q全可调</span>
      </div>

      {#if BUILTIN_PRESETS[preset]}
        <div class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] bg-black/5 dark:bg-white/[0.03] px-2.5 py-1 rounded-lg">
          <span class="text-xs">💡</span>
          <span class="text-[11px]">{BUILTIN_PRESETS[preset].desc}</span>
        </div>
      {/if}
    </div>

    <!-- 频谱响应曲线 Canvas 画布 -->
    <div class="rounded-xl overflow-hidden bg-black/20 dark:bg-black/40 border border-black/5 dark:border-white/5 mb-3">
      <canvas bind:this={canvas} class="w-full h-[120px] block"></canvas>
    </div>

    <!-- 5 段调节推杆卡片网格 -->
    <div class="grid grid-cols-5 gap-2 mb-4">
      {#each bands as b, i}
        <div class="flex flex-col items-center bg-black/5 dark:bg-white/[0.03] p-2.5 rounded-xl border border-black/5 dark:border-white/5 gap-1.5">
          <div class="text-xs font-bold text-[var(--text-main)]">{b.label}</div>
          <div class="text-[10px] text-[var(--text-muted)] font-mono">{b.freq}Hz</div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={b.gain}
            oninput={(e) => {
              bands[i].gain = parseFloat((e.target as HTMLInputElement).value);
              bands = bands;
            }}
            class="w-full h-1.5 accent-emerald-500 cursor-pointer my-1"
          />
          <div class="text-xs font-bold font-mono {b.gain > 0 ? 'text-emerald-500' : b.gain < 0 ? 'text-red-500' : 'text-[var(--text-muted)]'}">
            {b.gain > 0 ? '+' : ''}{b.gain}dB
          </div>
          <div class="w-full flex flex-col items-center gap-1 mt-1 pt-1.5 border-t border-black/5 dark:border-white/5">
            <div class="text-[10px] text-[var(--text-muted)] font-mono">Q {b.q.toFixed(1)}</div>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={b.q}
              oninput={(e) => {
                bands[i].q = parseFloat((e.target as HTMLInputElement).value);
                bands = bands;
              }}
              class="w-full h-1 accent-emerald-500/70 cursor-pointer"
            />
          </div>
        </div>
      {/each}
    </div>

    <!-- 底部操作按钮栏 -->
    <div class="flex justify-end gap-2.5 pt-2 border-t border-black/5 dark:border-white/5">
      <button type="button" onclick={reset} class="btn-secondary text-xs px-3.5 py-1.5">🔄 重置原音</button>
      <button type="button" onclick={onClose} class="btn-primary bg-gradient-to-br from-emerald-500 to-teal-600 text-xs px-4 py-1.5 font-semibold">✕ 完成关闭</button>
    </div>
  </div>
</div>
