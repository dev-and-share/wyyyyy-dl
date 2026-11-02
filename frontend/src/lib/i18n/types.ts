import type { zhCN } from './locales/zh-CN';

export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en', 'ko'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export const LOCALE_NAMES: Record<Locale, string> = {
  'zh-CN': '简体中文', // i18n-ignore
  'zh-TW': '繁體中文', // i18n-ignore
  'ja': '日本語', // i18n-ignore
  'en': 'English',
  'ko': '한국어'
};

export type MessageKey = keyof typeof zhCN;

// Extract {variable} placeholder parameters from string
export type ExtractPlaceholders<T extends string> =
  T extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractPlaceholders<Rest>
    : never;

// Parameter type definition
export type MessageParams = Record<string, string | number>;

export type TranslationDictionary = Record<MessageKey, string>;
