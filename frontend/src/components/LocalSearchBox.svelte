<script lang="ts">
  import { onMount } from 'svelte';

  let {
    value = $bindable(''),
    placeholder = '搜索...',
    historyKey = '',
    showHistory = true,
    type = 'search',
    clearTitle = '清空',
    debounceMs = 0,
    disabled = false,
    className = '',
    inputClassName = '',
    onSearch,
    onClear,
    onInput
  } = $props<{
    value: string;
    type?: 'search' | 'text';
    placeholder?: string;
    clearTitle?: string;
    historyKey?: string;
    showHistory?: boolean;
    debounceMs?: number;
    disabled?: boolean;
    className?: string;
    inputClassName?: string;
    onSearch?: (kw: string) => void;
    onClear?: () => void;
    onInput?: (kw: string) => void;
  }>();

  let historyList = $state<string[]>([]);
  let debounceTimer: any = null;

  function loadHistory() {
    if (!historyKey || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(historyKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) historyList = parsed;
      }
    } catch {}
  }

  function addHistory(kw: string) {
    if (!historyKey || typeof localStorage === 'undefined') return;
    const trimmed = kw.trim();
    if (!trimmed) return;
    const next = [trimmed, ...historyList.filter(item => item !== trimmed)].slice(0, 8);
    historyList = next;
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {}
  }

  function removeHistory(target: string) {
    if (!historyKey || typeof localStorage === 'undefined') return;
    const next = historyList.filter(item => item !== target);
    historyList = next;
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {}
  }

  function clearHistory() {
    if (!historyKey || typeof localStorage === 'undefined') return;
    historyList = [];
    try {
      localStorage.removeItem(historyKey);
    } catch {}
  }

  onMount(() => {
    loadHistory();
  });

  function handleInputChange(val: string) {
    value = val;
    onInput?.(val);
    if (debounceMs > 0) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onSearch?.(val);
      }, debounceMs);
    }
  }

  function handleSearchSubmit() {
    const trimmed = value.trim();
    if (trimmed && historyKey) {
      addHistory(trimmed);
    }
    onSearch?.(trimmed);
  }

  function handleClear() {
    value = '';
    onInput?.('');
    onClear?.();
    onSearch?.('');
  }
</script>

<div class="local-search-container w-full {className}">
  <!-- 输入框容器 (使用 type="text" 彻底根除 WebKit 浏览器双重 ✕ 问题) -->
  <div class="relative w-full flex items-center">
    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 pointer-events-none select-none">
      🔍
    </span>
    <input
      {type}
      enterkeyhint="search"
      {placeholder}
      {disabled}
      class="w-full pl-8 pr-8 py-2 text-xs md:text-sm rounded-xl bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-red-500/70 dark:focus:border-red-500/70 transition-all {inputClassName}"
      value={value}
      oninput={(e) => handleInputChange((e.currentTarget as HTMLInputElement).value)}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          (e.currentTarget as HTMLInputElement).blur();
          handleSearchSubmit();
        } else if (e.key === 'Escape') {
          handleClear();
        }
      }}
      onblur={handleSearchSubmit}
    />
    {#if value}
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer p-0 bg-transparent border-none"
        onclick={handleClear}
        title={clearTitle}
        aria-label={clearTitle}
      >
        ✕
      </button>
    {/if}
  </div>

  <!-- 🕒 搜索历史小胶囊列表 -->
  {#if showHistory && historyKey && historyList.length > 0}
    <div class="flex items-center flex-wrap gap-1.5 mt-2 text-xs">
      <span class="text-[var(--text-muted)] text-[11px] shrink-0">🕒 搜索历史:</span>
      {#each historyList as item}
        <div
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] border border-black/5 dark:border-white/10 transition-all hover:bg-red-500/10 hover:text-red-400 group"
        >
          <button
            type="button"
            class="cursor-pointer bg-transparent border-none p-0 text-inherit hover:underline"
            onclick={() => {
              value = item;
              handleInputChange(item);
              handleSearchSubmit();
            }}
          >
            {item}
          </button>
          <button
            type="button"
            class="opacity-40 hover:opacity-100 group-hover:opacity-70 transition-opacity cursor-pointer p-0 bg-transparent border-none text-[10px] leading-none"
            onclick={(e) => {
              e.stopPropagation();
              removeHistory(item);
            }}
            title="删除此条历史"
          >
            ✕
          </button>
        </div>
      {/each}
      <button
        type="button"
        class="text-[11px] text-[var(--text-muted)] hover:text-red-400 ml-auto cursor-pointer p-0 bg-transparent border-none transition-colors"
        onclick={clearHistory}
      >
        清空
      </button>
    </div>
  {/if}
</div>
