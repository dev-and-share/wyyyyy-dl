<script lang="ts" module>
  export type PlayerIconName =
    | 'play'
    | 'pause'
    | 'prev'
    | 'next'
    | 'repeat'
    | 'repeat-1'
    | 'shuffle'
    | 'heart'
    | 'list'
    | 'mic'
    | 'equalizer'
    | 'volume'
    | 'volume-low'
    | 'volume-mute'
    | 'close'
    | 'plus'
    | 'refresh'
    | 'spinner'
    | 'trash'
    | 'search'
    | 'folder'
    | 'download';
</script>

<script lang="ts">
  import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Repeat,
    Repeat1,
    Shuffle,
    Heart,
    ListMusic,
    Mic2,
    Sliders,
    Volume2,
    Volume1,
    VolumeX,
    X,
    Plus,
    RefreshCw,
    Loader2,
    Trash2,
    Search,
    Folder,
    Download
  } from '@lucide/svelte';

  let {
    name,
    size = 20,
    liked = false,
    class: customClass = ''
  } = $props<{
    name: PlayerIconName;
    size?: number;
    liked?: boolean;
    class?: string;
  }>();
</script>

{#if name === 'play'}
  <Play
    {size}
    fill="currentColor"
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'pause'}
  <Pause
    {size}
    fill="currentColor"
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'prev'}
  <SkipBack
    {size}
    fill="currentColor"
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'next'}
  <SkipForward
    {size}
    fill="currentColor"
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'repeat'}
  <Repeat
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'repeat-1'}
  <Repeat1
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'shuffle'}
  <Shuffle
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'heart'}
  <Heart
    {size}
    strokeWidth={liked ? 0 : 2}
    fill={liked ? '#ef4444' : 'none'}
    color={liked ? '#ef4444' : 'currentColor'}
    class="inline-block shrink-0 transition-transform active:scale-90 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'list'}
  <ListMusic
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'mic'}
  <Mic2
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'equalizer'}
  <Sliders
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'volume'}
  <Volume2
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'volume-low'}
  <Volume1
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'volume-mute'}
  <VolumeX
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'close'}
  <X
    {size}
    strokeWidth={2.2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'plus'}
  <Plus
    {size}
    strokeWidth={2.2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'refresh'}
  <RefreshCw
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'spinner'}
  <Loader2
    {size}
    strokeWidth={2.2}
    class="inline-block shrink-0 animate-spin {customClass}"
    aria-hidden="true"
  />
{:else if name === 'trash'}
  <Trash2
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'search'}
  <Search
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'folder'}
  <Folder
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{:else if name === 'download'}
  <Download
    {size}
    strokeWidth={2}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  />
{/if}
