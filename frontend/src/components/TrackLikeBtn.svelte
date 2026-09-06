<script lang="ts">
  import PlayerIcon from './PlayerIcon.svelte';

  let {
    liked = false,
    title = '',
    onclick
  } = $props<{
    liked?: boolean;
    title?: string;
    onclick?: () => void;
  }>();
</script>

<button
  type="button"
  class="bg-transparent border-none cursor-pointer p-1 leading-none inline-flex items-center justify-center transition-all hover:scale-115 active:scale-90 {liked ? 'text-red-500 opacity-100' : 'text-[var(--text-secondary)] opacity-60 hover:opacity-100 hover:text-red-400'}"
  title={title || (liked ? '取消红心' : '添加红心收藏')}
  {onclick}
>
  <PlayerIcon name="heart" {liked} size={17} />
</button>
