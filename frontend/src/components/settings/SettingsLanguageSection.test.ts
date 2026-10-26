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

  it('switches language when clicking language button', async () => {
    const { getByTestId } = render(SettingsLanguageSection);
    const enBtn = getByTestId('settings-lang-en');

    await fireEvent.click(enBtn);
    await vi.waitFor(() => {
      expect(i18n.locale).toBe('en');
    });

    const jaBtn = getByTestId('settings-lang-ja');
    await fireEvent.click(jaBtn);
    await vi.waitFor(() => {
      expect(i18n.locale).toBe('ja');
    });
  });
});
