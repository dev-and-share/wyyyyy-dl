<script lang="ts">
  import { onMount } from 'svelte';
  import { audioVisualizer } from '../../lib/player/audioVisualizer.svelte';

  let { playing = false, barCount = 10 } = $props<{ playing?: boolean; barCount?: number }>();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let isPlaying = $state(false);

  $effect(() => {
    isPlaying = playing;
  });

  onMount(() => {
    let animId = 0;
    const barHeights = new Float32Array(barCount);
    const peaks = new Float32Array(barCount);
    const holdTimers = new Int8Array(barCount);

    const render = () => {
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      const w = canvasEl.width;
      const h = canvasEl.height;
      ctx.clearRect(0, 0, w, h);

      const bands = audioVisualizer.bands;
      const barW = 3;
      const gap = 1;
      const totalBars = Math.min(barCount, bands.length);

      for (let i = 0; i < totalBars; i++) {
        // 播放中读取动态频段能量；暂停或静音时保持 1 像素底座待机荧光
        const curEnergy = isPlaying ? Math.max(0.06, bands[i] || 0) : 0.05;
        const targetH = Math.max(1, Math.min(h, curEnergy * h));

        // 经典 Winamp 柱身瞬态物理：
        // 瞬间弹起 (Instant Attack)；平滑匀速自然回落 (Smooth Falloff, 1.1px/帧)
        if (targetH >= barHeights[i]) {
          barHeights[i] = targetH;
        } else {
          barHeights[i] = Math.max(targetH, barHeights[i] - 1.1);
        }

        // 经典 Winamp 峰值横线算法 (Peak Hold & Floating Caps)
        if (barHeights[i] >= peaks[i]) {
          peaks[i] = barHeights[i];
          holdTimers[i] = 15; // 峰值线悬停约 15 帧 (~250ms)
        } else {
          if (holdTimers[i] > 0) {
            holdTimers[i]--;
          } else {
            peaks[i] = Math.max(0, peaks[i] - 0.48); // 缓缓飘落
          }
        }

        const x = i * (barW + gap) + 1;

        // 绘制经典 Winamp 点阵柱身 (每 2px 亮色，1px 暗隔)
        const currentH = Math.round(barHeights[i]);
        for (let y = h - 1; y >= h - currentH && y >= 0; y -= 2) {
          // 峰顶暖黄警戒，中区薄荷青，底座翡翠绿
          if (y < h * 0.28) {
            ctx.fillStyle = '#fef08a'; // 峰顶暖黄
          } else if (y < h * 0.55) {
            ctx.fillStyle = '#6ee7b7'; // 中区薄荷青
          } else {
            ctx.fillStyle = '#10b981'; // 经典翡翠绿
          }
          ctx.fillRect(x, y - 1, barW, 1.5);
        }

        // 绘制 Peak Hold 悬停横线
        if (peaks[i] > 2 && isPlaying) {
          const peakY = Math.max(0, Math.min(h - 1, h - Math.round(peaks[i])));
          ctx.fillStyle = '#fef9c3'; // 悬停白黄高亮峰值线
          ctx.fillRect(x, peakY, barW, 1);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  });
</script>

<div
  class="flex items-center justify-center h-6 px-1.5 py-0.5 bg-[#040804] border border-[#1b3d22] rounded shadow-inner select-none pointer-events-none"
  title="Real-time Winamp Spectrum Analyzer"
  data-testid="winamp-real-visualizer"
>
  <canvas
    bind:this={canvasEl}
    width="42"
    height="20"
    class="w-[42px] h-[20px] block"
  ></canvas>
</div>
