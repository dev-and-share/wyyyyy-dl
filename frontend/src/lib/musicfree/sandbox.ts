import CryptoJS from 'crypto-js';
import * as he from 'he';
import dayjs from 'dayjs';
import * as cheerio from 'cheerio';
import { createProxiedAxios } from './proxyAxios';
import type { IMusicFreePlugin } from './types';

/**
 * 🏃 纯净沙箱：动态执行 MusicFree 原版 JS 脚本代码
 * 自动注入插件依赖的标准库 (axios, crypto-js, he, dayjs, cheerio)
 */
export function executePluginScript(jsCode: string): IMusicFreePlugin {
  const proxiedAxios = createProxiedAxios();
  // 兼顾 ES Module 与 CommonJS 的 default 引用
  (proxiedAxios as any).default = proxiedAxios;

  const module = { exports: {} as any };
  const exports = module.exports;

  const customRequire = (name: string) => {
    const cleanName = name.replace(/^node:/, '').toLowerCase();

    if (cleanName === 'axios') {
      return proxiedAxios;
    }
    if (cleanName === 'crypto-js') {
      return (CryptoJS as any).default || CryptoJS;
    }
    if (cleanName === 'he') {
      return (he as any)?.default ?? he;
    }
    if (cleanName === 'dayjs') {
      return (dayjs as any)?.default ?? dayjs;
    }
    if (cleanName === 'cheerio') {
      return (cheerio as any)?.default ?? cheerio;
    }

    throw new Error(`Unsupported module in MusicFree plugin: "${name}"`);
  };

  // 🛡️ 注入安全容错的 JSON 对象，避免插件解析空字符串或 jsonp 时的 Fatal "Unexpected end of JSON input"
  const nativeParse = JSON.parse;
  const safeJSON = {
    ...JSON,
    parse: (text: any, reviver?: any) => {
      if (text == null) return {};
      if (typeof text !== 'string') {
        if (typeof text === 'object') return text;
        text = String(text);
      }
      const trimmed = text.trim();
      if (!trimmed) return {};
      try {
        return nativeParse(trimmed, reviver);
      } catch {
        // 自动剥离 jsonp 回调前缀与尾部括号：如 callback({...}) 或 MusicJsonCallback({...})
        const jsonpMatch = trimmed.match(/^[a-zA-Z0-9_$.]+\s*\(([\s\S]*)\)\s*;?$/);
        if (jsonpMatch && jsonpMatch[1]) {
          try {
            return nativeParse(jsonpMatch[1].trim(), reviver);
          } catch {}
        }
        // 尝试剥离非 JSON 前缀与后缀
        const startIdx = trimmed.indexOf('{');
        const endIdx = trimmed.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          try {
            return nativeParse(trimmed.substring(startIdx, endIdx + 1), reviver);
          } catch {}
        }
        console.warn('[MusicFree Sandbox] JSON.parse 宽容模式忽略畸形数据:', trimmed.slice(0, 80));
        return {};
      }
    }
  };

  try {
    const runner = new Function('module', 'exports', 'require', 'window', 'globalThis', 'JSON', jsCode);
    runner(module, exports, customRequire, typeof window !== 'undefined' ? window : {}, globalThis, safeJSON);
  } catch (err: any) {
    throw new Error(`Failed to execute MusicFree plugin script: ${err.message || err}`);
  }

  const plugin = module.exports?.default || module.exports;
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('MusicFree plugin did not export a valid object.');
  }

  return plugin as IMusicFreePlugin;
}
