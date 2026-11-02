import { zhCN } from './locales/zh-CN';
import { detectLocale, LOCALE_STORAGE_KEY } from './detect';
import type { Locale, MessageKey, MessageParams, TranslationDictionary } from './types';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES } from './types';

// 动态载入映射
const localeLoaders: Record<Locale, () => Promise<{ default: TranslationDictionary }>> = {
  'zh-CN': async () => ({ default: zhCN }),
  'zh-TW': () => import('./locales/zh-TW'),
  'ja': () => import('./locales/ja'),
  'en': () => import('./locales/en'),
  'ko': () => import('./locales/ko')
};

// 内存中缓存的字典
const messageCache: Record<string, TranslationDictionary> = {
  'zh-CN': zhCN
};

// 当前选中的语言状态 (Svelte 5 Runes)
let currentLocale = $state<Locale>(detectLocale());
let isReady = $state<boolean>(false);

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramName) => {
    if (paramName in params) {
      return String(params[paramName]);
    }
    return match;
  });
}

/**
 * 翻译字符串并填充插值变量
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const dict = messageCache[currentLocale];
  let raw: string | undefined = dict ? dict[key] : undefined;

  // 回退至 zh-CN
  if (raw === undefined && currentLocale !== DEFAULT_LOCALE) {
    const fallbackDict = messageCache[DEFAULT_LOCALE];
    raw = fallbackDict ? fallbackDict[key] : undefined;
  }

  // 兜底回退到 key 本身
  if (raw === undefined) {
    if (import.meta.env?.DEV) {
      console.warn(`[i18n] Missing translation for key: "${key}" in locale: "${currentLocale}"`);
    }
    return key;
  }

  return interpolate(raw, params);
}

/**
 * 复数形式翻译 (基于 Intl.PluralRules)
 */
export function tp(key: MessageKey, count: number, params?: MessageParams): string {
  let rule: Intl.LDMLPluralRule = 'other';
  try {
    const pr = new Intl.PluralRules(currentLocale);
    rule = pr.select(count);
  } catch {
    rule = count === 1 ? 'one' : 'other';
  }

  const specificKey = `${key}.${rule}` as MessageKey;
  const mergedParams = { count, ...params };

  // 优先看是否有 .one / .other
  const dict = messageCache[currentLocale];
  if (dict && specificKey in dict) {
    return t(specificKey, mergedParams);
  }

  // 再看默认 key
  return t(key, mergedParams);
}

/**
 * 切换语言
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    console.warn(`[i18n] Unsupported locale: ${locale}`);
    return;
  }

  if (!messageCache[locale]) {
    try {
      const loader = localeLoaders[locale];
      const mod = await loader();
      messageCache[locale] = mod.default;
    } catch (err) {
      console.error(`[i18n] Failed to load locale "${locale}":`, err);
      return;
    }
  }

  currentLocale = locale;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  } catch {}

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

/**
 * 应用启动时异步初始化语言
 */
export async function initLocale(): Promise<void> {
  const initial = detectLocale();
  if (initial !== DEFAULT_LOCALE && !messageCache[initial]) {
    await setLocale(initial);
  } else {
    currentLocale = initial;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = initial;
    }
  }
  isReady = true;
}

/**
 * 格式化日期
 */
export function formatDate(
  date: Date | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  try {
    return new Intl.DateTimeFormat(currentLocale, options).format(date);
  } catch {
    return new Date(date).toLocaleString();
  }
}

/**
 * 格式化数字
 */
export function formatNumber(
  num: number,
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(currentLocale, options).format(num);
  } catch {
    return String(num);
  }
}

/**
 * 格式化播放时长 (mm:ss 或 hh:mm:ss)
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const hh = String(hrs).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export const i18n = {
  get locale() {
    return currentLocale;
  },
  get isReady() {
    return isReady;
  },
  get supportedLocales() {
    return SUPPORTED_LOCALES;
  },
  get localeNames() {
    return LOCALE_NAMES;
  }
};
