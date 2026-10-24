<script lang="ts">
  let { playing = false, barCount = 10 } = $props<{ playing?: boolean; barCount?: number }>();

  // 10 根频谱柱的不同运动振幅和延迟
  const barConfigs = [
    { delay: '0.1s', dur: '0.6s' },
    { delay: '0.3s', dur: '0.5s' },
    { delay: '0.0s', dur: '0.7s' },
    { delay: '0.4s', dur: '0.55s' },
    { delay: '0.2s', dur: '0.65s' },
    { delay: '0.5s', dur: '0.48s' },
    { delay: '0.15s', dur: '0.62s' },
    { delay: '0.35s', dur: '0.52s' },
    { delay: '0.25s', dur: '0.58s' },
    { delay: '0.05s', dur: '0.68s' }
  ];
</script>

<div
  class="flex items-end gap-[1.5px] h-6 px-1.5 py-1 bg-[#061008] border border-[#1b3d22] rounded shadow-inner select-none pointer-events-none"
  title="Winamp 实时频谱示波器"
>
  {#each barConfigs.slice(0, barCount) as cfg}
    <div
      class="w-1 bg-[#10b981] rounded-xs origin-bottom transition-all"
      class:animate-winamp-bounce={playing}
      style="height: 100%; animation-delay: {cfg.delay}; animation-duration: {cfg.dur}; {playing ? '' : 'transform: scaleY(0.15); opacity: 0.4;'}"
    ></div>
  {/each}
</div>

<style>
  @keyframes winampBounce {
    0% { transform: scaleY(0.2); }
    25% { transform: scaleY(0.95); }
    50% { transform: scaleY(0.4); }
    75% { transform: scaleY(0.8); }
    100% { transform: scaleY(0.2); }
  }
  .animate-winamp-bounce {
    animation: winampBounce ease-in-out infinite;
  }
</style>
