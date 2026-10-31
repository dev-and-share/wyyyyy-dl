<script lang="ts">
  import PlayerIcon from './PlayerIcon.svelte';
  import { t } from '../lib/i18n';

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
  title={title || (liked ? t('player.likeRemove') : t('player.likeAdd'))}
  {onclick}
>
  <PlayerIcon name="heart" {liked} size={17} />
</button>
