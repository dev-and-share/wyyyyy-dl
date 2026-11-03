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

  try {
    const runner = new Function('module', 'exports', 'require', 'window', 'globalThis', jsCode);
    runner(module, exports, customRequire, typeof window !== 'undefined' ? window : {}, globalThis);
  } catch (err: any) {
    throw new Error(`Failed to execute MusicFree plugin script: ${err.message || err}`);
  }

  const plugin = module.exports?.default || module.exports;
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('MusicFree plugin did not export a valid object.');
  }

  return plugin as IMusicFreePlugin;
}
