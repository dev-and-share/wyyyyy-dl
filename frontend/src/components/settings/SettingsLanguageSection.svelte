<script lang="ts">
  import { i18n, setLocale, t } from '../../lib/i18n/index.svelte';
  import type { Locale } from '../../lib/i18n/types';

  const languages: { id: Locale; label: string }[] = [
    { id: 'zh-CN', label: '简体中文' }, // i18n-ignore: language native name
    { id: 'zh-TW', label: '繁體中文' }, // i18n-ignore: language native name
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' }, // i18n-ignore: language native name
    { id: 'ko', label: '한국어' }
  ];

  async function handleSelect(lang: Locale) {
    if (i18n.locale === lang) return;
    await setLocale(lang);
  }
</script>

<section class="flex flex-col gap-2.5">
  <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <span>🌐</span>
    <span>{t('settings.language')}</span>
  </div>
  <div class="p-1.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] grid grid-cols-2 sm:grid-cols-3 gap-1">
    {#each languages as lang}
      <button
        type="button"
        data-testid="settings-lang-{lang.id}"
        class="py-2 px-1 rounded-xl text-xs font-medium cursor-pointer border-none transition-all flex items-center justify-center text-center {i18n.locale === lang.id ? 'bg-[var(--card-bg)] text-[var(--text-main)] shadow-sm font-bold' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}"
        onclick={() => handleSelect(lang.id)}
      >
        <span>{lang.label}</span>
      </button>
    {/each}
  </div>
</section>
