<script lang="ts">
  import { getTrackSourceStatus } from '../lib/trackStatus.svelte';
  import type { Track } from '../lib/types';

  let {
    id,
    isLocal = false,
    curTrack = null,
    class: customClass = ''
  } = $props<{
    id: number | string | undefined | null;
    isLocal?: boolean;
    curTrack?: Track | null;
    class?: string;
  }>();

  let status = $derived(getTrackSourceStatus(id, isLocal, curTrack));
</script>

{#if status.isServer && status.isPhone}
  <span
    class="audio-source-badge icon-only badge-both {customClass}"
    title="✨ 本机手机与服务器均已下载/缓存"
  >
    ✨
  </span>
{:else if status.isServer}
  <span
    class="audio-source-badge icon-only badge-server {customClass}"
    title="🖥️ 已下载到本地服务器磁盘"
  >
    🖥️
  </span>
{:else if status.isPhone}
  <span
    class="audio-source-badge icon-only badge-browser {customClass}"
    title="📲 已离线缓存到当前手机/浏览器"
  >
    📲
  </span>
{/if}
