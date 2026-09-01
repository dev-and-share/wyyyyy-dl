<script lang="ts">
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
  class="bg-transparent border-none cursor-pointer text-sm px-1 leading-none inline-flex items-center justify-center transition-transform hover:scale-125 {liked ? 'opacity-100 scale-110' : 'opacity-60'}"
  title={title || (liked ? '取消红心' : '添加红心收藏')}
  {onclick}
>
  {liked ? '❤️' : '🤍'}
</button>
