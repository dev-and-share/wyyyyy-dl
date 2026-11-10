<script lang="ts">
  import { skin } from '../lib/skinStore.svelte';
  import { SKIN_LIST, type SkinId } from './skins/skinTypes';
  import PlayerIcon from './PlayerIcon.svelte';
  import { t } from '../lib/i18n/index.svelte';

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
  aria-label={t('player.skin')}
  data-testid="skin-picker-sheet"
  class="fixed z-[100011] inset-x-0 bottom-0 max-w-[960px] max-h-[88vh] overflow-y-auto mx-auto rounded-t-[28px] border-t border-[var(--border-color)] bg-[var(--card-bg-solid,var(--card-bg))] text-[var(--text-main)] shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 transition-transform duration-200 ease-out backdrop-blur-xl"
  style="transform: {closing ? 'translateY(100%)' : 'translateY(0)'};"
>
  <!-- 头部：标题与关闭按钮 -->
  <div class="flex items-center justify-between pb-1">
    <div class="flex items-center gap-2">
      <span class="text-xl leading-none">🎨</span>
      <h3 class="text-base font-bold text-[var(--text-main)] m-0">{t('player.skin')}</h3>
      <span class="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[var(--text-secondary)]">12</span>
    </div>
    <button
      type="button"
      class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
      onclick={handleClose}
      title={t('common.close')}
    >
      <PlayerIcon name="close" size={15} />
    </button>
  </div>

  <!-- 皮肤卡片列表：SP 完美 3 列 (3×4=12)，PC 完美 6 列 (6×2=12) -->
  <div class="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-2.5">
    {#each SKIN_LIST as item}
      {@const isSelected = skin.current === item.id}
      <button
        type="button"
        class="relative flex flex-col items-center p-2 rounded-2xl border-2 transition-all cursor-pointer text-left bg-black/5 dark:bg-white/5 hover:scale-102 active:scale-97 {isSelected
          ? 'border-red-500 bg-red-500/10 shadow-md shadow-red-500/20'
          : 'border-transparent hover:border-[var(--border-subtle)]'}"
        onclick={() => handleSelect(item.id)}
      >
        <!-- 选中角标 -->
        {#if isSelected}
          <div class="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs z-20">
            ✓
          </div>
        {/if}

        <!-- 迷你缩略图预览 -->
        <div class="w-full h-14 sm:h-15 rounded-xl overflow-hidden relative mb-1.5 flex items-center justify-center bg-neutral-900 border border-white/10 select-none">
          {#if item.id === 'vinyl'}
            <!-- 黑胶迷你预览 -->
            <div class="w-10 h-10 rounded-full bg-[#111] border border-neutral-700 p-1 flex items-center justify-center relative shadow-sm">
              <div class="w-4.5 h-4.5 rounded-full bg-red-600/80 border border-white/20"></div>
              <div class="absolute top-0 right-1 w-2.5 h-4 border-r-2 border-neutral-300 rotate-15 origin-top"></div>
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
          {:else if item.id === 'cd'}
            <!-- 千禧 CD 随身听迷你预览 (全息彩虹盘面 + 纯正 Discman 工业设计) -->
            <div class="w-12 h-10 rounded-lg bg-gradient-to-b from-[#2b3a4a] to-[#121924] border border-sky-400/40 p-1 flex items-center justify-center relative shadow-xs overflow-hidden">
              <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-400 via-fuchsia-400 to-amber-300 p-0.5 flex items-center justify-center shadow-inner animate-[spin_8s_linear_infinite]">
                <div class="w-4 h-4 rounded-full bg-slate-900 border border-white/40 flex items-center justify-center text-[7px]">💿</div>
              </div>
              <div class="absolute bottom-0.5 right-1 text-[7px] font-mono text-emerald-400 font-bold drop-shadow">ESP</div>
            </div>
          {:else if item.id === 'tube'}
            <!-- 复古胆机迷你预览 (胡桃木 + 橙光真空管 + Minuet猫咪) -->
            <div class="w-12 h-9 rounded-md bg-gradient-to-b from-[#451a03] to-[#1c0b02] border border-amber-600/40 p-1 flex flex-col justify-between shadow-xs relative overflow-hidden">
              <div class="flex justify-around items-center pt-0.5">
                <div class="w-2 h-3.5 rounded-t-full bg-amber-400/80 border border-amber-200/60 shadow-[0_0_6px_rgba(245,158,11,0.8)]"></div>
                <div class="w-2 h-3.5 rounded-t-full bg-amber-400/80 border border-amber-200/60 shadow-[0_0_6px_rgba(245,158,11,0.8)]"></div>
              </div>
              <div class="flex justify-between items-center text-[7px] text-amber-300/80 px-1">
                <span>VU</span>
                <span class="text-[9px]">🐱</span>
              </div>
            </div>
          {:else if item.id === 'winamp'}
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
          {:else if item.id === 'cyber'}
            <!-- 赛博霓虹迷你预览 (80s蒸汽波落日 + 机器人) -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#3b0764] via-[#1e0b36] to-[#090214]">
              <div class="w-7 h-7 rounded-full bg-gradient-to-t from-fuchsia-500 to-amber-400 shadow-[0_0_8px_rgba(217,70,239,0.8)] flex items-center justify-center text-[8px]">
                🤖
              </div>
              <div class="absolute bottom-0 inset-x-0 h-3 border-t border-cyan-400/50 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(6,182,212,0.4)_4px,rgba(6,182,212,0.4)_6px)]"></div>
            </div>
          {:else if item.id === 'aurora'}
            <!-- 极光迷你预览 -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center">
              <div class="absolute -top-2 -left-2 w-9 h-9 rounded-full bg-indigo-500 blur-sm opacity-80"></div>
              <div class="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-rose-500 blur-sm opacity-80"></div>
              <div class="w-6.5 h-6.5 rounded-lg bg-neutral-800 border border-white/30 shadow-md z-10"></div>
            </div>
          {:else if item.id === 'rain'}
            <!-- 雨夜窗扉迷你预览 (雨滴与车流散景) -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#0f1f3d] via-[#09152b] to-[#040914]">
              <div class="absolute top-1 left-2 w-2 h-2 rounded-full bg-amber-400/60 blur-xs"></div>
              <div class="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-rose-500/60 blur-xs"></div>
              <div class="w-8 h-8 rounded-full border border-sky-300/40 bg-sky-950/60 flex items-center justify-center text-[9px] shadow-sm">
                🌧️
              </div>
            </div>
          {:else if item.id === 'sakura'}
            <!-- 春樱初绽迷你预览 -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-pink-950 via-rose-900 to-pink-900">
              <div class="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-pink-400 blur-xs opacity-80"></div>
              <div class="w-9 h-9 rounded-full bg-pink-900/90 border border-pink-400/70 p-1 flex items-center justify-center relative shadow-sm">
                <div class="w-4 h-4 rounded-full bg-pink-500/90 border border-pink-200 flex items-center justify-center text-[9px]">🌸</div>
              </div>
            </div>
          {:else if item.id === 'summer'}
            <!-- 盛夏晴空迷你预览 -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-sky-950 via-blue-900 to-cyan-950">
              <div class="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-sky-400 blur-xs opacity-80"></div>
              <div class="w-9 h-9 rounded-full bg-sky-900/90 border border-sky-400/70 p-1 flex items-center justify-center relative shadow-sm">
                <div class="w-4 h-4 rounded-full bg-yellow-400/95 border border-sky-200 flex items-center justify-center text-[9px]">🌻</div>
              </div>
            </div>
          {:else if item.id === 'autumn'}
            <!-- 金秋落叶迷你预览 -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-amber-950 via-yellow-950 to-amber-900">
              <div class="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-400 blur-xs opacity-80"></div>
              <div class="w-9 h-9 rounded-full bg-amber-900/90 border border-yellow-400/70 p-1 flex items-center justify-center relative shadow-sm">
                <div class="w-4 h-4 rounded-full bg-yellow-400/95 border border-yellow-200 flex items-center justify-center text-[9px]">🍂</div>
              </div>
            </div>
          {:else if item.id === 'winter'}
            <!-- 凛冬初雪迷你预览 -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
              <div class="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white blur-xs opacity-80"></div>
              <div class="w-9 h-9 rounded-full bg-slate-900/90 border border-white/80 p-1 flex items-center justify-center relative shadow-sm">
                <div class="w-4 h-4 rounded-full bg-white/95 border border-slate-300 flex items-center justify-center text-[9px]">❄️</div>
              </div>
            </div>
          {:else}
            <!-- 兜底备用 (如 spring) -->
            <div class="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-900 to-green-950">
              <div class="w-8 h-8 rounded-full bg-emerald-700/80 border border-emerald-300/40 p-1 flex items-center justify-center">
                <span class="text-[9px]">🍃</span>
              </div>
            </div>
          {/if}
        </div>

        <div class="text-[11px] sm:text-xs font-bold text-[var(--text-main)] flex items-center gap-1 truncate max-w-full">
          <span>{item.emoji}</span>
          <span class="truncate">{t(`player.skin.${item.id}.name` as any)}</span>
        </div>
        <div class="text-[9px] sm:text-[10px] text-[var(--text-muted)] text-center line-clamp-1 mt-0.5 max-w-full">
          {t(`player.skin.${item.id}.desc` as any)}
        </div>
      </button>
    {/each}
  </div>
</div>
