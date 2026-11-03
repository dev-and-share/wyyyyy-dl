import { executePluginScript } from './sandbox';
import type { InstalledPluginRecord, SubscriptionMeta, IMusicFreePlugin } from './types';
import { builtinPlugins, resolveFallbackFromBuiltins } from './plugins';

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
        const seenNames = new Set<string>();
        const uniqueRecords = records.filter((r) => {
          const n = (r.name || '').trim();
          if (!n || seenNames.has(n)) return false;
          seenNames.add(n);
          return true;
        });
        this.plugins = uniqueRecords.map((rec) => {
          if (rec.code && rec.enabled !== false) {
            try {
              return { ...rec, instance: executePluginScript(rec.code), error: undefined };
            } catch (err: any) {
              return { ...rec, instance: undefined, error: err.message || 'Execution error' };
            }
          }
          return rec;
        });
      }
    } catch {}

    // 🌟 自动注入官方原生内置插件 (QQ音乐 / 酷我 / 酷狗官方直连)
    for (const bp of builtinPlugins) {
      const id = `builtin_${bp.platform}`;
      const existing = this.plugins.find((p) => p.id === id || p.name === bp.platform);
      if (!existing) {
        this.plugins.unshift({
          id, name: bp.platform, version: bp.version || '1.0.0', author: bp.author || 'wyyyyy-dl 官方',
          url: bp.srcUrl || '', code: '', enabled: true, supportedSearchType: bp.supportedSearchType || ['music'], instance: bp
        });
      } else {
        existing.instance = bp;
        existing.id = id;
      }
    }
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
    const idx = this.plugins.findIndex((p) => p.id === record.id || p.name === record.name);
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
    item.enabled = enabled !== undefined ? enabled : !item.enabled;
    if (item.enabled && !item.instance && item.code) {
      try {
        item.instance = executePluginScript(item.code);
        item.error = undefined;
      } catch (err: any) {
        item.error = err.message || 'Execution error';
      }
    }
    this.saveToStorage();
  }

  removePlugin(id: string) {
    this.plugins = this.plugins.filter((p) => p.id !== id);
    this.saveToStorage();
  }

  cleanupJunkPlugins(): number {
    const junkKeywords = ['歌曲宝', '书音', '6yueting', '好听轻音乐', '爱听', '种子', 'audiomack', '有声', '评书'];
    const initialCount = this.plugins.length;
    this.plugins = this.plugins.filter((p) => !junkKeywords.some((kw) => (p.name || '').toLowerCase().includes(kw)));
    const removed = initialCount - this.plugins.length;
    if (removed > 0) this.saveToStorage();
    return removed;
  }

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
   * 获取某个曲目的流播放地址（自动处理防盗链转接与官方兜底）
   */
  async resolveMediaSource(pluginId: string, track: any, quality = 'standard'): Promise<{ url: string; headers?: Record<string, string> }> {
    const record = this.plugins.find((p) => p.id === pluginId);
    let source: any = null;

    if (record && record.instance && typeof record.instance.getMediaSource === 'function') {
      try {
        source = await record.instance.getMediaSource(track, quality);
      } catch (e: any) {
        console.warn(`[MusicFree] 插件 ${record.name} 获取流地址异常:`, e?.message || e);
      }
    }

    // 🚀 全网跨源智能官方直链兜底 (优先走官方原生内置插件池)
    if (!source || !source.url) {
      source = await resolveFallbackFromBuiltins(track);
    }

    if (!source || !source.url) {
      throw new Error(`音源插件未能解析出音频地址`);
    }

    let finalUrl = source.url;
    if (source.url.startsWith('http://') || source.url.startsWith('https://')) {
      const q = new URLSearchParams({ url: source.url });
      const ref = source.headers?.referer || source.headers?.Referer;
      const ua = source.headers?.['user-agent'] || source.headers?.['User-Agent'];
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

  /**
   * 获取指定插件或所有插件的排行榜列表 (自动规整多层分组与扁平结构，过滤掉无效项)
   */
  async getTopLists(pluginId?: string): Promise<Array<{
    pluginId: string;
    pluginName: string;
    subGroups: Array<{
      groupTitle: string;
      charts: any[];
    }>;
  }>> {
    const targets = pluginId
      ? this.plugins.filter((p) => p.id === pluginId && p.enabled && p.instance)
      : this.getActivePlugins();

    const results: Array<{
      pluginId: string;
      pluginName: string;
      subGroups: Array<{ groupTitle: string; charts: any[] }>;
    }> = [];

    for (const pluginRec of targets) {
      const inst = pluginRec.instance;
      if (inst && typeof inst.getTopLists === 'function') {
        try {
          const list = await inst.getTopLists();
          if (Array.isArray(list) && list.length > 0) {
            const subGroups: Array<{ groupTitle: string; charts: any[] }> = [];

            for (const item of list) {
              if (item && Array.isArray(item.data)) {
                // 这是一个分组结构：如 { title: "巅峰榜", data: [...] }
                const validCharts = item.data.filter((c: any) => c && (c.id != null || c.topId != null));
                if (validCharts.length > 0) {
                  subGroups.push({
                    groupTitle: item.title || '精选榜单',
                    charts: validCharts
                  });
                }
              } else if (item && (item.id != null || item.topId != null)) {
                // 这是一个扁平榜单项
                let defaultGroup = subGroups.find((g) => g.groupTitle === '官方排行榜');
                if (!defaultGroup) {
                  defaultGroup = { groupTitle: '官方排行榜', charts: [] };
                  subGroups.push(defaultGroup);
                }
                defaultGroup.charts.push(item);
              }
            }

            if (subGroups.length > 0) {
              results.push({
                pluginId: pluginRec.id,
                pluginName: pluginRec.name,
                subGroups
              });
            }
          }
        } catch (e) {
          console.warn(`[MusicFree] 获取 ${pluginRec.name} 排行榜失败:`, e);
        }
      }
    }
    return results;
  }

  /**
   * 获取排行榜详情（曲目列表）- 深度容错安全包装
   */
  async getTopListDetail(pluginId: string, topListItem: any): Promise<any> {
    const record = this.plugins.find((p) => p.id === pluginId);
    if (!record || !record.instance || typeof record.instance.getTopListDetail !== 'function') {
      return { isEnd: true, musicList: [] };
    }
    if (!topListItem || (topListItem.id == null && !topListItem.topId)) {
      return { isEnd: true, musicList: [] };
    }
    try {
      const res = await record.instance.getTopListDetail(topListItem);
      const musicList = Array.isArray(res?.musicList) ? res.musicList : (Array.isArray(res) ? res : []);
      return {
        isEnd: typeof res?.isEnd === 'boolean' ? res.isEnd : false,
        musicList: musicList.filter((m: any) => m && (m.title || m.name))
      };
    } catch (e: any) {
      console.warn(`[MusicFree] 获取榜单详情异常: ${record.name}`, e?.message || e);
      return { isEnd: true, musicList: [] };
    }
  }

  /**
   * 获取歌单广场标签 - 深度容错安全包装
   */
  async getRecommendSheetTags(pluginId: string): Promise<any> {
    const record = this.plugins.find((p) => p.id === pluginId);
    if (!record || !record.instance || typeof record.instance.getRecommendSheetTags !== 'function') {
      return null;
    }
    try {
      return await record.instance.getRecommendSheetTags();
    } catch (e: any) {
      console.warn(`[MusicFree] 获取歌单标签异常: ${record.name}`, e?.message || e);
      return null;
    }
  }

  /**
   * 根据标签获取推荐歌单 - 深度容错安全包装
   */
  async getRecommendSheetsByTag(pluginId: string, tag: any, page = 1): Promise<any> {
    const record = this.plugins.find((p) => p.id === pluginId);
    if (!record || !record.instance || typeof record.instance.getRecommendSheetsByTag !== 'function') {
      return { isEnd: true, data: [] };
    }
    try {
      const res = await record.instance.getRecommendSheetsByTag(tag, page);
      const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      return { isEnd: typeof res?.isEnd === 'boolean' ? res.isEnd : (data.length === 0), data: data.filter((item: any) => item && (item.title || item.name)) };
    } catch (e: any) {
      console.warn(`[MusicFree] 获取推荐歌单异常: ${record.name}`, e?.message || e);
      return { isEnd: true, data: [], error: e?.message || String(e) };
    }
  }

  /**
   * 获取歌单详情与歌曲 - 深度容错安全包装
   */
  async getMusicSheetInfo(pluginId: string, sheetItem: any, page = 1): Promise<any> {
    const record = this.plugins.find((p) => p.id === pluginId);
    if (!record || !record.instance || typeof record.instance.getMusicSheetInfo !== 'function') {
      return { isEnd: true, musicList: [] };
    }
    try {
      const res = await record.instance.getMusicSheetInfo(sheetItem, page);
      const musicList = Array.isArray(res?.musicList) ? res.musicList : (Array.isArray(res) ? res : []);
      return {
        isEnd: typeof res?.isEnd === 'boolean' ? res.isEnd : false,
        musicList: musicList.filter((m: any) => m && (m.title || m.name))
      };
    } catch (e: any) {
      console.warn(`[MusicFree] 获取歌单曲目异常: ${record.name}`, e?.message || e);
      return { isEnd: true, musicList: [] };
    }
  }
}

export const musicFreeStore = new MusicFreeStore();
