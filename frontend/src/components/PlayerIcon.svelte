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
    | 'close';
</script>

<script lang="ts">
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
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8.5 5.82v12.36c0 .87.96 1.4 1.69.93l9.62-6.18c.67-.43.67-1.43 0-1.86l-9.62-6.18c-.73-.47-1.69.06-1.69.93z" />
  </svg>
{:else if name === 'pause'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="6.5" y="5" width="3.5" height="14" rx="1.75" />
    <rect x="14" y="5" width="3.5" height="14" rx="1.75" />
  </svg>
{:else if name === 'prev'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="3.75" y="5.5" width="2.5" height="13" rx="1.25" />
    <path d="M18.25 6.13c0-.9-1.01-1.44-1.76-.94L8.13 11.06c-.67.45-.67 1.43 0 1.88l8.36 5.87c.75.5 1.76-.04 1.76-.94V6.13z" />
  </svg>
{:else if name === 'next'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5.75 6.13c0-.9 1.01-1.44 1.76-.94l8.36 5.87c.67.45.67 1.43 0 1.88l-8.36 5.87c-.75.5-1.76-.04-1.76-.94V6.13z" />
    <rect x="17.75" y="5.5" width="2.5" height="13" rx="1.25" />
  </svg>
{:else if name === 'repeat'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  >
    <path
      d="M16 7H8a5 5 0 0 0 0 10h8a5 5 0 0 0 5-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <polygon points="14.5 3.5, 20.5 7, 14.5 10.5" fill="currentColor" />
  </svg>
{:else if name === 'repeat-1'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  >
    <path
      d="M16 7H8a5 5 0 0 0 0 10h8a5 5 0 0 0 5-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <polygon points="14.5 3.5, 20.5 7, 14.5 10.5" fill="currentColor" />
    <path
      d="M10.8 11.2L12.3 9.8v5.4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{:else if name === 'shuffle'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    aria-hidden="true"
  >
    <path
      d="M4 8h2.5C9 8 11 16.5 14 16.5h1.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <polygon points="14.5 13.5, 20.5 16.5, 14.5 19.5" fill="currentColor" />
    <path
      d="M4 16.5h2.5C9 16.5 11 8 14 8h1.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <polygon points="14.5 5, 20.5 8, 14.5 11" fill="currentColor" />
  </svg>
{:else if name === 'heart'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 transition-transform active:scale-90 {customClass}"
    aria-hidden="true"
  >
    {#if liked}
      <path
        d="M12 20.25c-.32 0-.64-.11-.9-.32C5.9 15.68 2.5 12.65 2.5 8.8 2.5 5.7 4.9 3.25 8 3.25c1.78 0 3.44.82 4 2.15.56-1.33 2.22-2.15 4-2.15 3.1 0 5.5 2.45 5.5 5.55 0 3.85-3.4 6.88-8.6 11.13-.26.21-.58.32-.9.32z"
        fill="#ef4444"
        stroke="#ef4444"
        stroke-width="1"
      />
    {:else}
      <path
        d="M12 20.25c-.32 0-.64-.11-.9-.32C5.9 15.68 2.5 12.65 2.5 8.8 2.5 5.7 4.9 3.25 8 3.25c1.78 0 3.44.82 4 2.15.56-1.33 2.22-2.15 4-2.15 3.1 0 5.5 2.45 5.5 5.55 0 3.85-3.4 6.88-8.6 11.13-.26.21-.58.32-.9.32z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}
  </svg>
{:else if name === 'list'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" stroke-width="3" />
    <line x1="3" y1="12" x2="3.01" y2="12" stroke-width="3" />
    <line x1="3" y1="18" x2="3.01" y2="18" stroke-width="3" />
  </svg>
{:else if name === 'mic'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
{:else if name === 'equalizer'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
{:else if name === 'volume'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 5a9.5 9.5 0 0 1 0 14" />
  </svg>
{:else if name === 'volume-low'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </svg>
{:else if name === 'volume-mute'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
{:else if name === 'close'}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class="inline-block shrink-0 {customClass}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
{/if}
