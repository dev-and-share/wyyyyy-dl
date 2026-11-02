import { describe, it, expect, beforeEach, vi } from 'vitest';
import { t, tp, setLocale, i18n, formatDuration, formatNumber } from './index.svelte';
import { detectLocale, normalizeLocale, LOCALE_STORAGE_KEY } from './detect';
import { zhCN } from './locales/zh-CN';
import zhTW from './locales/zh-TW';
import en from './locales/en';
import ja from './locales/ja';
import ko from './locales/ko';
import type { MessageKey } from './types';

describe('i18n infrastructure', () => {
  beforeEach(async () => {
    localStorage.clear();
    await setLocale('zh-CN');
  });

  describe('Language detection and normalization', () => {
    it('normalizes various language code formats correctly', () => {
      expect(normalizeLocale('zh-TW')).toBe('zh-TW');
      expect(normalizeLocale('zh-HK')).toBe('zh-TW');
      expect(normalizeLocale('zh-Hant-TW')).toBe('zh-TW');
      expect(normalizeLocale('zh-CN')).toBe('zh-CN');
      expect(normalizeLocale('zh')).toBe('zh-CN');
      expect(normalizeLocale('ja-JP')).toBe('ja');
      expect(normalizeLocale('ko-KR')).toBe('ko');
      expect(normalizeLocale('en-US')).toBe('en');
      expect(normalizeLocale('fr-FR')).toBeNull();
    });

    it('detects locale from localStorage if available', () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'ja');
      expect(detectLocale()).toBe('ja');
    });

    it('falls back to default zh-CN when no match found', () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'unknown_lang');
      const originalLanguages = navigator.languages;
      Object.defineProperty(navigator, 'languages', {
        value: ['fr-FR', 'de-DE'],
        configurable: true
      });
      try {
        expect(detectLocale()).toBe('zh-CN');
      } finally {
        Object.defineProperty(navigator, 'languages', {
          value: originalLanguages,
          configurable: true
        });
      }
    });
  });

  describe('Translation and Interpolation', () => {
    it('translates static keys in zh-CN', () => {
      expect(t('common.confirm')).toBe('确定');
      expect(t('player.play')).toBe('播放');
    });

    it('interpolates parameters correctly', () => {
      expect(t('playlist.trackCount', { count: 42 })).toBe('42 首');
      expect(t('error.operationFailed', { message: 'Network Timeout' })).toBe('操作失败: Network Timeout');
    });

    it('falls back to raw key if key does not exist', () => {
      // @ts-expect-error Testing non-existent key fallback
      expect(t('non.existent.key')).toBe('non.existent.key');
    });
  });

  describe('Pluralization (tp)', () => {
    it('handles plural forms in English', async () => {
      await setLocale('en');
      expect(tp('playlist.trackCount', 1)).toBe('1 track');
      expect(tp('playlist.trackCount', 5)).toBe('5 tracks');
    });

    it('handles single form in Asian languages', async () => {
      await setLocale('zh-CN');
      expect(tp('playlist.trackCount', 1)).toBe('1 首');
      expect(tp('playlist.trackCount', 10)).toBe('10 首');
    });
  });

  describe('Dynamic loading and Locale switching', () => {
    it('dynamically switches locale and updates reactive state', async () => {
      expect(i18n.locale).toBe('zh-CN');
      expect(t('settings.appearance')).toBe('外观与主题');

      await setLocale('en');
      expect(i18n.locale).toBe('en');
      expect(t('settings.appearance')).toBe('Appearance');

      await setLocale('ja');
      expect(i18n.locale).toBe('ja');
      expect(t('settings.appearance')).toBe('外観とテーマ');

      await setLocale('ko');
      expect(i18n.locale).toBe('ko');
      expect(t('settings.appearance')).toBe('화면 및 테마');

      await setLocale('zh-TW');
      expect(i18n.locale).toBe('zh-TW');
      expect(t('settings.appearance')).toBe('外觀與主題');
    });

    it('persists selected locale to localStorage', async () => {
      await setLocale('ja');
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ja');
    });
  });

  describe('Formatting helpers', () => {
    it('formats duration into mm:ss or hh:mm:ss', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(75)).toBe('01:15');
      expect(formatDuration(3665)).toBe('01:01:05');
      expect(formatDuration(-10)).toBe('00:00');
    });

    it('formats numbers according to active locale', async () => {
      await setLocale('en');
      expect(formatNumber(1234567)).toBe('1,234,567');
    });
  });

  describe('Locale dictionary parity and integrity', () => {
    const baseKeys = Object.keys(zhCN).sort() as MessageKey[];
    const dictionaries: Record<string, Record<string, string>> = {
      'zh-TW': zhTW,
      en,
      ja,
      ko
    };

    function extractVars(str: string): string[] {
      const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
      return matches.map(m => m.slice(1, -1)).sort();
    }

    for (const [lang, dict] of Object.entries(dictionaries)) {
      it(`[${lang}] contains all keys defined in zh-CN`, () => {
        const dictKeys = Object.keys(dict).sort();
        const missingKeys = baseKeys.filter(k => !(k in dict));
        expect(missingKeys, `Missing keys in ${lang}`).toEqual([]);
        expect(dictKeys.length).toBe(baseKeys.length);
      });

      it(`[${lang}] maintains consistent placeholder variables with zh-CN`, () => {
        for (const key of baseKeys) {
          const baseVars = extractVars(zhCN[key] || '');
          const targetVars = extractVars(dict[key] || '');
          expect(targetVars, `Variable mismatch in ${lang} for key "${key}"`).toEqual(baseVars);
        }
      });
    }
  });
});
