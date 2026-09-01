<script lang="ts">
  let { onClose } = $props<{ onClose: () => void }>();
  type Band = { freq: number; gain: number; q: number; label: string; desc: string };
  let enabled = $state(true);
  let bands = $state<Band[]>([
    { freq: 60, gain: 0, q: 1.4, label: '低频下潜', desc: '60Hz' },
    { freq: 230, gain: 0, q: 1.4, label: '去箱声/闷', desc: '230Hz' },
    { freq: 910, gain: 0, q: 2.0, label: '人声主体', desc: '910Hz' },
    { freq: 3600, gain: 0, q: 2.5, label: '细节提亮', desc: '3.6kHz' },
    { freq: 14000, gain: 0, q: 0.7, label: '空气感', desc: '14kHz' },
  ]);
  let preset = $state('flat');

  const BUILTIN_PRESETS: Record<string, { name: string; desc: string; bands: { freq: number; gain: number; q: number }[] }> = {
    flat: {
      name: '平直原音 (Flat)',
      desc: '原汁原味无调色',
      bands: [
        { freq: 60, gain: 0, q: 1.4 },
        { freq: 230, gain: 0, q: 1.4 },
        { freq: 910, gain: 0, q: 2.0 },
        { freq: 3600, gain: 0, q: 2.5 },
        { freq: 14000, gain: 0, q: 0.7 }
      ]
    },
    macbook: {
      name: 'MacBook 外放校正 (去箱鸣)',
      desc: '削弱 130Hz 浑浊共振，补偿 60Hz 与 14kHz 空气感',
      bands: [
        { freq: 60, gain: 2.5, q: 1.4 },
        { freq: 230, gain: -3.5, q: 2.0 },
        { freq: 910, gain: 0, q: 2.0 },
        { freq: 3600, gain: 1.5, q: 2.2 },
        { freq: 14000, gain: 2.0, q: 0.7 }
      ]
    },
    vocal: {
      name: '人声毒药 (清澈温暖)',
      desc: '清理 230Hz 箱鸣，提亮 3.6kHz 人声细节并平抑齿音',
      bands: [
        { freq: 60, gain: -0.5, q: 1.4 },
        { freq: 230, gain: -2.0, q: 1.8 },
        { freq: 910, gain: 1.5, q: 1.8 },
        { freq: 3600, gain: 2.5, q: 2.2 },
        { freq: 14000, gain: -1.5, q: 1.2 }
      ]
    },
    bass: {
      name: '澎湃重低音 (Bass Boost)',
      desc: '强劲极低频下潜，适度收敛中低频防浑浊',
      bands: [
        { freq: 60, gain: 5.0, q: 1.2 },
        { freq: 230, gain: -1.0, q: 1.4 },
        { freq: 910, gain: 0, q: 2.0 },
        { freq: 3600, gain: 1.0, q: 2.0 },
        { freq: 14000, gain: 1.0, q: 0.7 }
      ]
    },
    air: {
      name: '通透耳机 (Headphone Air)',
      desc: '提升 14kHz 极高频空气感与开阔声场',
      bands: [
        { freq: 60, gain: 1.5, q: 1.4 },
        { freq: 230, gain: -1.0, q: 1.4 },
        { freq: 910, gain: 0.5, q: 2.0 },
        { freq: 3600, gain: 2.0, q: 2.5 },
        { freq: 14000, gain: 3.5, q: 0.7 }
      ]
    }
  };

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

<!-- 🎛️ 5 段参量均衡器统一抽屉 (支持全套白天/黑夜主题 + 移动端底部滑出 Bottom Sheet) -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="peq-drawer-overlay" onclick={onClose}>
  <div class="peq-drawer-modal" onclick={(e) => e.stopPropagation()}>
    <!-- 头部栏 -->
    <div class="peq-header">
      <div class="peq-title-row">
        <span class="peq-icon">🎛️</span>
        <h3 class="peq-title">5 段参量均衡器 (PEQ)</h3>
      </div>
      <button class="peq-close-btn" onclick={onClose} title="关闭均衡器">✕</button>
    </div>

    <!-- 预设与启用开关栏 -->
    <div class="peq-toolbar">
      <div class="peq-toolbar-row">
        <label class="peq-enable-switch">
          <input type="checkbox" checked={enabled} onchange={(e) => (enabled = (e.target as HTMLInputElement).checked)} />
          <span>⚡ 启用</span>
        </label>

        <select
          class="peq-preset-select"
          value={preset}
          onchange={(e) => applyPreset((e.target as HTMLSelectElement).value)}
        >
          {#each Object.entries(BUILTIN_PRESETS) as [k, item]}
            <option value={k}>{item.name}</option>
          {/each}
        </select>

        <span class="peq-tip-text">5段频率/增益/Q全可调</span>
      </div>

      {#if BUILTIN_PRESETS[preset]}
        <div class="peq-preset-desc-badge">
          <span class="desc-badge-icon">💡</span>
          <span class="desc-badge-text">{BUILTIN_PRESETS[preset].desc}</span>
        </div>
      {/if}
    </div>

    <!-- 频谱响应曲线 Canvas 画布 -->
    <div class="peq-canvas-card">
      <canvas bind:this={canvas} class="peq-canvas"></canvas>
    </div>

    <!-- 5 段调节推杆卡片网格 -->
    <div class="peq-bands-grid">
      {#each bands as b, i}
        <div class="peq-band-col">
          <div class="peq-band-label">{b.label}</div>
          <div class="peq-band-freq-sub">{b.freq}Hz</div>
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
            class="peq-slider"
          />
          <div
            class="peq-band-gain"
            style="color: {b.gain > 0 ? '#10b981' : b.gain < 0 ? '#ef4444' : 'var(--text-muted)'};"
          >
            {b.gain > 0 ? '+' : ''}{b.gain}dB
          </div>
          <div class="peq-band-q-wrap">
            <div class="peq-band-q-label">Q {b.q.toFixed(1)}</div>
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
              class="peq-slider-small"
            />
          </div>
        </div>
      {/each}
    </div>

    <!-- 底部操作按钮栏 -->
    <div class="peq-footer">
      <button onclick={reset} class="btn-secondary peq-footer-btn">🔄 重置原音</button>
      <button onclick={onClose} class="btn-primary peq-footer-btn peq-confirm-btn">✕ 完成关闭</button>
    </div>
  </div>
</div>

<style>
  .peq-drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 10002;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    animation: peqFadeIn 0.2s ease-out;
  }

  @keyframes peqFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .peq-drawer-modal {
    background: var(--card-bg-solid, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    color: var(--text-main, #0f172a);
    box-shadow: var(--shadow-lg, 0 16px 40px rgba(0, 0, 0, 0.25));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    margin-right: 20px;
    margin-bottom: 75px;
    width: 680px;
    max-width: calc(100vw - 30px);
    max-height: calc(100vh - 100px);
    border-radius: 16px;
    padding: 16px 20px;
    animation: peqSlideUpPC 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes peqSlideUpPC {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .peq-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .peq-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .peq-icon {
    font-size: 18px;
  }

  .peq-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-main, #0f172a);
  }

  .peq-close-btn {
    background: transparent;
    border: none;
    font-size: 18px;
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.2s ease;
  }

  .peq-close-btn:hover {
    background: var(--btn-slot-hover-bg, rgba(0, 0, 0, 0.06));
    color: var(--text-main);
  }

  .peq-toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .peq-toolbar-row {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .peq-enable-switch {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main, #0f172a);
    cursor: pointer;
    flex-shrink: 0;
  }

  .peq-enable-switch input[type="checkbox"] {
    accent-color: var(--primary-color, #10b981);
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .peq-preset-select {
    flex: 1;
    min-width: 200px;
    padding: 7px 12px;
    border-radius: 8px;
    background: var(--input-bg, #f8fafc);
    color: var(--text-main, #0f172a);
    border: 1px solid var(--input-border, #cbd5e1);
    font-size: 13px;
    font-weight: 600;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .peq-preset-select:focus {
    border-color: var(--primary-color, #10b981);
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  }

  .peq-preset-select option {
    background: var(--card-bg-solid, #ffffff);
    color: var(--text-main, #0f172a);
    padding: 6px 10px;
  }

  .peq-tip-text {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted, #94a3b8);
    flex-shrink: 0;
  }

  .peq-preset-desc-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--btn-slot-bg, #f1f5f9);
    border: 1px solid var(--border-subtle, #e2e8f0);
    font-size: 12px;
    color: var(--text-secondary, #475569);
  }

  .desc-badge-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .desc-badge-text {
    line-height: 1.4;
  }

  .peq-canvas-card {
    background: var(--btn-slot-bg, #f1f5f9);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 12px;
    padding: 8px;
    margin-bottom: 12px;
  }

  .peq-canvas {
    width: 100%;
    height: 110px;
    display: block;
    border-radius: 8px;
  }

  .peq-bands-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .peq-band-col {
    background: var(--btn-slot-bg, #ffffff);
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 10px;
    padding: 10px 6px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .peq-band-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main, #0f172a);
    margin-bottom: 2px;
  }

  .peq-band-freq-sub {
    font-size: 10px;
    color: var(--text-muted, #64748b);
  }

  .peq-slider {
    width: 100%;
    margin: 8px 0 4px 0;
    accent-color: var(--primary-color, #10b981);
    cursor: pointer;
  }

  .peq-band-gain {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .peq-band-q-wrap {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed var(--border-subtle, #e2e8f0);
  }

  .peq-band-q-label {
    font-size: 10px;
    color: var(--text-muted, #64748b);
  }

  .peq-slider-small {
    width: 90%;
    margin-top: 2px;
    accent-color: var(--primary-color, #10b981);
    cursor: pointer;
  }

  .peq-footer {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    align-items: center;
  }

  .peq-footer-btn {
    padding: 7px 14px;
    font-size: 12px;
  }

  .peq-confirm-btn {
    margin-left: auto;
    padding: 7px 18px;
  }

  /* 📱 移动端 SP：底部滑升抽屉（Bottom Sheet），与播放队列完全一致 */
  @media (max-width: 768px) {
    .peq-drawer-overlay {
      justify-content: center !important;
      align-items: flex-end !important;
    }

    .peq-drawer-modal {
      margin: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      height: 75vh !important;
      max-height: 82vh !important;
      border-radius: 20px 20px 0 0 !important;
      border-bottom: none !important;
      border-left: none !important;
      border-right: none !important;
      box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.25) !important;
      animation: peqSlideUpSP 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
      padding-bottom: env(safe-area-inset-bottom, 16px) !important;
    }

    @keyframes peqSlideUpSP {
      from { transform: translateY(100%); opacity: 0.5; }
      to { transform: translateY(0); opacity: 1; }
    }

    .peq-bands-grid {
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
    }
  }
</style>
