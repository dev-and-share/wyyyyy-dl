<script lang="ts">
  import { customBgStore } from '../../lib/customBgStore.svelte';

  let { playing = false } = $props<{ playing?: boolean }>();

  let videoEl = $state<HTMLVideoElement | null>(null);
  let imgEl = $state<HTMLImageElement | null>(null);

  $effect(() => {
    if (customBgStore.type === 'image' && imgEl && imgEl.complete && imgEl.naturalWidth > 0 && !customBgStore.topColor) {
      customBgStore.sampleFromElement(imgEl);
    }
  });

  // 严格确保视频背景 100% 静音无声播放，杜绝干扰音频流
  $effect(() => {
    if (customBgStore.type === 'video' && videoEl) {
      videoEl.muted = true;
      videoEl.volume = 0;
      videoEl.setAttribute('webkit-playsinline', 'true');
      if (playing) {
        const p = videoEl.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } else {
        videoEl.pause();
      }
    }
  });
</script>

{#if customBgStore.enabled && customBgStore.url}
  <div
    data-testid="custom-background-stage"
    class="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none"
    aria-hidden="true"
  >
    {#if customBgStore.type === 'image'}
      <img
        bind:this={imgEl}
        src={customBgStore.url}
        alt="Custom Player Background"
        data-testid="custom-bg-image"
        onload={(e) => customBgStore.sampleFromElement(e.currentTarget as HTMLImageElement)}
        class="absolute inset-0 w-full h-full transition-[filter,transform,object-position] duration-300 ease-out"
        style="
          filter: blur({customBgStore.blur}px);
          object-fit: {customBgStore.fit};
          object-position: {customBgStore.positionX}% {customBgStore.positionY}%;
          transform: scale({customBgStore.scale});
          transform-origin: {customBgStore.positionX}% {customBgStore.positionY}%;
        "
      />
    {:else if customBgStore.type === 'video'}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={videoEl}
        src={customBgStore.url}
        data-testid="custom-bg-video"
        onloadeddata={(e) => customBgStore.sampleFromElement(e.currentTarget as HTMLVideoElement)}
        autoplay
        loop
        muted
        playsinline
        disablepictureinpicture
        class="absolute inset-0 w-full h-full transition-[filter,transform,object-position] duration-300 ease-out"
        style="
          filter: blur({customBgStore.blur}px);
          object-fit: {customBgStore.fit};
          object-position: {customBgStore.positionX}% {customBgStore.positionY}%;
          transform: scale({customBgStore.scale});
          transform-origin: {customBgStore.positionX}% {customBgStore.positionY}%;
        "
      ></video>
    {/if}

    <!-- 电影级暗场调光遮罩 (保证歌词与操作面板的高清晰阅读对比度) -->
    <div
      data-testid="custom-bg-dim-overlay"
      class="absolute inset-0 pointer-events-none transition-colors duration-200"
      style="background: rgba(0, 0, 0, {customBgStore.dimOpacity});"
    ></div>
  </div>
{/if}
