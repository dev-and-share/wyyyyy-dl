import { executePluginScript } from './sandbox';
import type { InstalledPluginRecord, SubscriptionMeta, IMusicFreePlugin } from './types';

const STORAGE_PLUGINS_KEY = 'wyyyy_musicfree_plugins_v1';
const STORAGE_SUBS_KEY = 'wyyyy_musicfree_subs_v1';

class MusicFreeStore {
  plugins = $state<InstalledPluginRecord[]>([]);
  subscriptions = $state<SubscriptionMeta[]>([]);
  loading = $state(false);
  statusMessage = $state('');

  constructor() {
    this.init();
  }

  private init() {
    if (typeof localStorage === 'undefined') return;

    try {
      const savedSubs = localStorage.getItem(STORAGE_SUBS_KEY);
      if (savedSubs) {
        this.subscriptions = JSON.parse(savedSubs);
      }
    } catch {}

    try {
      const savedPlugins = localStorage.getItem(STORAGE_PLUGINS_KEY);
      if (savedPlugins) {
        const records: InstalledPluginRecord[] = JSON.parse(savedPlugins);
        this.plugins = records.map((rec) => {
          if (rec.code && rec.enabled !== false) {
            try {
              const instance = executePluginScript(rec.code);
              return { ...rec, instance, error: undefined };
            } catch (err: any) {
              return { ...rec, instance: undefined, error: err.message || 'Execution error' };
            }
          }
          return rec;
        });
      }
    } catch {}
  }

  private saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      // 存储时剔除内存中的 instance 实例
      const cleanRecords = this.plugins.map(({ instance, ...rest }) => rest);
      localStorage.setItem(STORAGE_PLUGINS_KEY, JSON.stringify(cleanRecords));
      localStorage.setItem(STORAGE_SUBS_KEY, JSON.stringify(this.subscriptions));
    } catch (e) {
      console.error('Failed to save MusicFree plugins to localStorage', e);
    }
  }

  /**
   * 通过后端通用 Fetch 拉取外部资源文本（解决跨域）
   */
  async fetchText(url: string): Promise<string> {
    try {
      const res = await fetch(`/v3/plugin/fetch?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (json && typeof json.code === 'string' && json.code !== '000000') {
            throw new Error(json.msg || `后端代理返回错误: ${json.code}`);
          }
        } catch (e: any) {
          if (e.message?.includes('后端代理返回错误')) throw e;
        }
        return text;
      }
    } catch (err: any) {
      console.warn(`代理拉取 ${url} 失败:`, err.message || err);
    }

    // 兜底尝试前端直连
    const direct = await fetch(url);
    if (!direct.ok) {
      throw new Error(`连接目标地址失败: ${url} (状态码: ${direct.status})`);
    }
    return await direct.text();
  }

  /**
   * 安装订阅源或单脚本
   */
  async installFromUrl(targetUrl: string): Promise<{ successCount: number; errors: string[] }> {
    const trimmed = targetUrl.trim();
    if (!trimmed) throw new Error('请输入有效的插件或订阅源 URL');

    this.loading = true;
    this.statusMessage = '正在连接目标音源地址...';
    const errors: string[] = [];
    let successCount = 0;

    try {
      const text = await this.fetchText(trimmed);
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(text);
      } catch {}

      if (parsedJson && Array.isArray(parsedJson.plugins)) {
        // 这是一个 plugins.json 订阅源
        const pluginList: Array<{ name: string; url: string; version?: string }> = parsedJson.plugins;
        this.statusMessage = `发现 ${pluginList.length} 个音源插件，开始并发拉取并编译...`;

        for (let i = 0; i < pluginList.length; i++) {
          const item = pluginList[i];
          this.statusMessage = `[${i + 1}/${pluginList.length}] 正在安装 ${item.name}...`;
          try {
            const jsCode = await this.fetchText(item.url);
            const instance = executePluginScript(jsCode);
            this.upsertPluginRecord({
              id: `${instance.platform || item.name}_${item.url}`,
              name: instance.platform || item.name,
              version: instance.version || item.version || '0.1.0',
              author: instance.author || '未知作者',
              url: item.url,
              code: jsCode,
              enabled: true,
              supportedSearchType: instance.supportedSearchType || ['music'],
              instance
            });
            successCount++;
          } catch (err: any) {
            errors.push(`${item.name}: ${err.message || err}`);
          }
        }

        // 记录订阅源
        const existingSubIdx = this.subscriptions.findIndex((s) => s.url === trimmed);
        const subRecord: SubscriptionMeta = {
          url: trimmed,
          name: parsedJson.desc || '音源合集',
          pluginsCount: pluginList.length,
          addedAt: Date.now()
        };
        if (existingSubIdx >= 0) {
          this.subscriptions[existingSubIdx] = subRecord;
        } else {
          this.subscriptions.push(subRecord);
        }
      } else if (parsedJson && (parsedJson.code || parsedJson.error || parsedJson.msg)) {
        throw new Error(parsedJson.msg || parsedJson.error || '获取失败：目标地址返回了异常 JSON 响应');
      } else {
        const trimmedText = text.trim();
        if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
          throw new Error('目标地址返回的是 JSON 格式，但未包含有效的 plugins 列表');
        }
        if (trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html')) {
          throw new Error('目标地址返回的是 HTML 网页内容，而非有效 JS 插件脚本');
        }
        // 单个 JS 脚本安装
        this.statusMessage = '正在编译并执行单插件脚本...';
        const instance = executePluginScript(text);
        const pluginId = `${instance.platform || 'CustomPlugin'}_${trimmed}`;
        this.upsertPluginRecord({
          id: pluginId,
          name: instance.platform || '自定义插件',
          version: instance.version || '0.1.0',
          author: instance.author || '未知作者',
          url: trimmed,
          code: text,
          enabled: true,
          supportedSearchType: instance.supportedSearchType || ['music'],
          instance
        });
        successCount++;
      }

      this.saveToStorage();
      return { successCount, errors };
    } finally {
      this.loading = false;
      this.statusMessage = '';
    }
  }

  private upsertPluginRecord(record: InstalledPluginRecord) {
    const idx = this.plugins.findIndex((p) => p.id === record.id || (p.name === record.name && p.url === record.url));
    if (idx >= 0) {
      this.plugins[idx] = { ...this.plugins[idx], ...record };
    } else {
      this.plugins.push(record);
    }
  }

  /**
   * 切换插件启用/禁用状态
   */
  togglePlugin(id: string, enabled?: boolean) {
    const item = this.plugins.find((p) => p.id === id);
    if (!item) return;
    const targetState = enabled !== undefined ? enabled : !item.enabled;
    item.enabled = targetState;

    if (targetState && !item.instance && item.code) {
      try {
        item.instance = executePluginScript(item.code);
        item.error = undefined;
      } catch (err: any) {
        item.error = err.message || 'Execution error';
      }
    }
    this.saveToStorage();
  }

  /**
   * 卸载单个插件
   */
  removePlugin(id: string) {
    this.plugins = this.plugins.filter((p) => p.id !== id);
    this.saveToStorage();
  }

  /**
   * 移除整个订阅源及关联插件
   */
  removeSubscription(url: string) {
    this.subscriptions = this.subscriptions.filter((s) => s.url !== url);
    this.saveToStorage();
  }

  /**
   * 获取所有启用的插件实例
   */
  getActivePlugins(): InstalledPluginRecord[] {
    return this.plugins.filter((p) => p.enabled && p.instance);
  }

  /**
   * 聚合搜索所有已启用的插件
   */
  async searchAll(keyword: string, page = 1): Promise<{ results: any[]; errors: string[] }> {
    const active = this.getActivePlugins();
    if (active.length === 0) return { results: [], errors: ['未启用任何 MusicFree 音源插件'] };

    const errors: string[] = [];
    const aggregatedResults: any[] = [];

    await Promise.allSettled(
      active.map(async (pluginRec) => {
        const inst = pluginRec.instance;
        if (!inst || typeof inst.search !== 'function') return;

        try {
          const res = await inst.search(keyword, page, 'music');
          const list = Array.isArray(res) ? res : res?.data || [];
          for (const item of list) {
            aggregatedResults.push({
              ...item,
              _pluginId: pluginRec.id,
              _pluginPlatform: pluginRec.name,
              _isMusicFree: true
            });
          }
        } catch (err: any) {
          errors.push(`${pluginRec.name}: ${err.message || err}`);
        }
      })
    );

    return { results: aggregatedResults, errors };
  }

  /**
   * 获取某个曲目的流播放地址（自动处理防盗链转接）
   */
  async resolveMediaSource(pluginId: string, track: any, quality = 'standard'): Promise<{ url: string; headers?: Record<string, string> }> {
    const record = this.plugins.find((p) => p.id === pluginId);
    if (!record || !record.instance || typeof record.instance.getMediaSource !== 'function') {
      throw new Error(`找不到音源插件或该插件不支持解析音频: ${pluginId}`);
    }

    const source = await record.instance.getMediaSource(track, quality);
    if (!source || !source.url) {
      throw new Error(`音源插件未能解析出音频地址`);
    }

    let finalUrl = source.url;
    const ref = source.headers?.referer || source.headers?.Referer;
    const ua = source.headers?.['user-agent'] || source.headers?.['User-Agent'];

    // 若插件明确指示需要特定 Referer / UA 防盗链，或者为 HTTP 协议，走 Spring Boot /v3/stream/online 中继流
    if (ref || ua || source.url.startsWith('http://')) {
      const q = new URLSearchParams();
      q.set('url', source.url);
      if (ref) q.set('referer', ref);
      if (ua) q.set('ua', ua);
      finalUrl = `/v3/stream/online?${q.toString()}`;
    }

    return {
      url: finalUrl,
      headers: source.headers
    };
  }

  /**
   * 获取歌词
   */
  async resolveLyric(pluginId: string, track: any): Promise<{ rawLrc?: string; translation?: string }> {
    const record = this.plugins.find((p) => p.id === pluginId);
    if (!record || !record.instance || typeof record.instance.getLyric !== 'function') {
      return {};
    }
    try {
      return (await record.instance.getLyric(track)) || {};
    } catch {
      return {};
    }
  }
}

export const musicFreeStore = new MusicFreeStore();
