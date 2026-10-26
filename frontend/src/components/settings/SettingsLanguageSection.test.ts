import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SettingsLanguageSection from './SettingsLanguageSection.svelte';
import { i18n, setLocale } from '../../lib/i18n/index.svelte';

describe('SettingsLanguageSection', () => {
  beforeEach(async () => {
    await setLocale('zh-CN');
  });

  it('renders all 5 supported languages', () => {
    const { getByTestId } = render(SettingsLanguageSection);
    expect(getByTestId('settings-lang-zh-CN')).toBeInTheDocument();
    expect(getByTestId('settings-lang-zh-TW')).toBeInTheDocument();
    expect(getByTestId('settings-lang-en')).toBeInTheDocument();
    expect(getByTestId('settings-lang-ja')).toBeInTheDocument();
    expect(getByTestId('settings-lang-ko')).toBeInTheDocument();
  });

  it('switches language when changing select dropdown', async () => {
    const { getByTestId } = render(SettingsLanguageSection);
    const select = getByTestId('settings-language-select') as HTMLSelectElement;

    await fireEvent.change(select, { target: { value: 'en' } });
    await vi.waitFor(() => {
      expect(i18n.locale).toBe('en');
    });

    await fireEvent.change(select, { target: { value: 'ja' } });
    await vi.waitFor(() => {
      expect(i18n.locale).toBe('ja');
    });
  });
});
