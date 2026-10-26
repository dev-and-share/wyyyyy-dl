import type { Locale } from './types';
import { DEFAULT_LOCALE } from './types';

export const LOCALE_STORAGE_KEY = 'wyl.locale';

export function normalizeLocale(lang: string | null | undefined): Locale | null {
  if (!lang || typeof lang !== 'string') return null;
  const lower = lang.toLowerCase().trim();

  // 繁体中文优先匹配
  if (
    lower.startsWith('zh-tw') ||
    lower.startsWith('zh-hk') ||
    lower.startsWith('zh-mo') ||
    lower.includes('hant')
  ) {
    return 'zh-TW';
  }

  // 简体中文
  if (lower.startsWith('zh')) {
    return 'zh-CN';
  }

  // 日文
  if (lower.startsWith('ja')) {
    return 'ja';
  }

  // 韩文
  if (lower.startsWith('ko')) {
    return 'ko';
  }

  // 英文
  if (lower.startsWith('en')) {
    return 'en';
  }

  return null;
}

export function detectLocale(): Locale {
  // 1. 本地持久化缓存
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      const matched = normalizeLocale(saved);
      if (matched) return matched;
    }
  } catch {
    // 忽略 localStorage 异常 (例如隐私模式)
  }

  // 2. 浏览器语言偏好检测
  try {
    if (typeof navigator !== 'undefined') {
      const languages = navigator.languages || (navigator.language ? [navigator.language] : []);
      for (const lang of languages) {
        const matched = normalizeLocale(lang);
        if (matched) return matched;
      }
    }
  } catch {
    // 忽略 navigator 访问异常
  }

  // 3. 兜底默认语言
  return DEFAULT_LOCALE;
}
