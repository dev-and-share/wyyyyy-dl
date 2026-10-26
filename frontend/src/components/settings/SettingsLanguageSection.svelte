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

  async function handleChange(e: Event) {
    const select = e.currentTarget as HTMLSelectElement;
    const lang = select.value as Locale;
    if (i18n.locale === lang) return;
    await setLocale(lang);
  }
</script>

<section class="flex flex-col gap-2.5">
  <div class="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
    <span>🌐</span>
    <span>{t('settings.language')}</span>
  </div>
  <div class="p-3.5 rounded-2xl bg-[var(--nav-tabs-bg)] border border-[var(--border-color)] flex items-center justify-between gap-3">
    <div class="flex flex-col gap-0.5 min-w-0">
      <span class="font-semibold text-sm text-[var(--text-main)]">{t('settings.language')}</span>
      <span class="text-xs text-[var(--text-secondary)]">
        {languages.find((l) => l.id === i18n.locale)?.label || 'English'}
      </span>
    </div>
    <div class="relative shrink-0">
      <select
        data-testid="settings-language-select"
        class="appearance-none bg-[var(--card-bg-solid,var(--card-bg))] text-[var(--text-main)] border border-[var(--border-color)] rounded-xl py-2 pl-3.5 pr-8 text-xs font-semibold cursor-pointer outline-none hover:border-[var(--primary-color)] focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-glow)] transition-all shadow-sm"
        value={i18n.locale}
        onchange={handleChange}
        aria-label={t('settings.language')}
      >
        {#each languages as lang}
          <option data-testid="settings-lang-{lang.id}" value={lang.id} class="bg-[var(--card-bg-solid,#111827)] text-[var(--text-main)] py-1">
            {lang.label}
          </option>
        {/each}
      </select>
      <span class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)] text-[10px] select-none">
        ▼
      </span>
    </div>
  </div>
</section>
