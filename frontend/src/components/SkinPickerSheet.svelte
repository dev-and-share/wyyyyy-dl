<script lang="ts">
  import { skin } from '../lib/skinStore.svelte';
  import { SKIN_LIST, type SkinId } from './skins/skinTypes';
  import PlayerIcon from './PlayerIcon.svelte';

  let { onClose } = $props<{ onClose: () => void }>();

  let closing = $state(false);

  function handleClose() {
    if (closing) return;
    closing = true;
    setTimeout(() => {
      closing = false;
      onClose();
    }, 180);
  }

  function handleSelect(id: SkinId) {
    skin.set(id);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- 全局半透明遮罩 -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[100010] bg-black/60 backdrop-blur-xs transition-opacity duration-200 {closing ? 'opacity-0' : 'opacity-100'}"
  onclick={handleClose}
></div>

<!-- 底部弹出的换肤面板 -->
<div
  role="dialog"
  aria-modal="true"
  aria-label="选择播放器皮肤"
  data-testid="skin-picker-sheet"
  class="fixed z-[100011] inset-x-0 bottom-0 max-w-[720px] mx-auto rounded-t-[28px] border-t border-[var(--border-color)] bg-[var(--card-bg-solid,var(--card-bg))] text-[var(--text-main)] shadow-2xl p-5 flex flex-col gap-4 transition-transform duration-200 ease-out backdrop-blur-xl"
  style="transform: {closing ? 'translateY(100%)' : 'translateY(0)'};"
>
  <!-- 头部：标题与关闭按钮 -->
  <div class="flex items-center justify-between pb-1">
    <div class="flex items-center gap-2">
      <span class="text-xl leading-none">🎨</span>
      <h3 class="text-base font-bold text-[var(--text-main)] m-0">播放器皮肤</h3>
    </div>
    <button
      type="button"
      class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
      onclick={handleClose}
      title="关闭"
    >
      <PlayerIcon name="close" size={15} />
    </button>
  </div>

  <!-- 皮肤卡片列表（移动端 2-3 列，桌面端 5 列） -->
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
    {#each SKIN_LIST as item}
      {@const isSelected = skin.current === item.id}
      <button
        type="button"
        class="relative flex flex-col items-center p-2.5 rounded-2xl border-2 transition-all cursor-pointer text-left bg-black/5 dark:bg-white/5 hover:scale-102 active:scale-97 {isSelected
          ? 'border-red-500 bg-red-500/10 shadow-md shadow-red-500/20'
          : 'border-transparent hover:border-[var(--border-subtle)]'}"
        onclick={() => handleSelect(item.id)}
      >
        <!-- 选中角标 -->
        {#if isSelected}
          <div class="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
            ✓
          </div>
        {/if}

        <!-- 迷你缩略图预览 -->
        <div class="w-full h-15 rounded-xl overflow-hidden relative mb-2 flex items-center justify-center bg-neutral-900 border border-white/10">
          {#if item.id === 'vinyl'}
            <!-- 黑胶迷你预览 -->
            <div class="w-10 h-10 rounded-full bg-[#111] border border-neutral-700 p-1 flex items-center justify-center relative shadow-sm">
              <div class="w-4.5 h-4.5 rounded-full bg-red-600/80 border border-white/20"></div>
              <div class="absolute top-0 right-1 w-2.5 h-4 border-r-2 border-neutral-300 rotate-15 origin-top"></div>
            </div>
          {:else if item.id === 'aurora'}
            <!-- 极光迷你预览 -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center">
              <div class="absolute -top-2 -left-2 w-9 h-9 rounded-full bg-indigo-500 blur-sm opacity-80"></div>
              <div class="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-rose-500 blur-sm opacity-80"></div>
              <div class="w-6.5 h-6.5 rounded-lg bg-neutral-800 border border-white/30 shadow-md z-10"></div>
            </div>
          {:else if item.id === 'cassette'}
            <!-- 磁带迷你预览 -->
            <div class="w-12 h-8.5 rounded-md bg-[#222] border border-neutral-600 p-1 flex flex-col justify-between items-center shadow-xs">
              <div class="w-full h-1.5 rounded-xs bg-[#e2dcce] opacity-90"></div>
              <div class="w-full flex justify-around items-center">
                <div class="w-2 h-2 rounded-full bg-white border border-neutral-400"></div>
                <div class="w-2 h-2 rounded-full bg-white border border-neutral-400"></div>
              </div>
              <div class="w-4 h-1 rounded-xs bg-emerald-500/80"></div>
            </div>
          {:else if item.id === 'spring'}
            <!-- 春日青绿迷你预览 -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-900 to-green-950">
              <div class="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-400 blur-xs opacity-60"></div>
              <div class="w-9 h-9 rounded-full bg-emerald-700/80 border border-emerald-300/40 p-1 flex items-center justify-center relative shadow-sm">
                <div class="w-4 h-4 rounded-full bg-lime-400/90 border border-white/40 flex items-center justify-center text-[9px]">🍃</div>
              </div>
            </div>
          {:else}
            <!-- Winamp 迷你预览 -->
            <div class="w-13 h-9 rounded-xs bg-gradient-to-b from-[#343b47] to-[#1c1f26] border border-white/20 p-1 flex flex-col justify-between shadow-xs">
              <div class="flex items-center justify-between text-[7px] font-mono text-amber-400 leading-none">
                <span>⚡</span>
                <span class="text-emerald-400 font-bold">128K</span>
              </div>
              <div class="flex items-end gap-0.5 h-3 justify-center">
                <div class="w-1 h-3 bg-emerald-500 rounded-xs"></div>
                <div class="w-1 h-2 bg-emerald-500 rounded-xs"></div>
                <div class="w-1 h-2.5 bg-emerald-500 rounded-xs"></div>
                <div class="w-1 h-1.5 bg-emerald-500 rounded-xs"></div>
              </div>
            </div>
          {/if}
        </div>

        <div class="text-xs font-bold text-[var(--text-main)] flex items-center gap-1">
          <span>{item.emoji}</span>
          <span>{item.name}</span>
        </div>
        <div class="text-[10px] text-[var(--text-muted)] text-center line-clamp-1 mt-0.5">
          {item.desc}
        </div>
      </button>
    {/each}
  </div>
</div>
