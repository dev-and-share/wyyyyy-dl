import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale } from '../i18n';
import {
  getPluginDisplayName,
  getPluginDisplayAuthor,
  getTopListGroupTitle,
  getTopListDisplayInfo
} from './pluginI18n';

describe('pluginI18n helper', () => {
  beforeEach(async () => {
    await setLocale('zh-CN');
  });

  it('translates builtin plugin names according to locale', async () => {
    await setLocale('zh-CN');
    expect(getPluginDisplayName({ id: 'builtin_酷狗音乐 (官方)', name: '酷狗音乐 (官方)' })).toBe('酷狗音乐 (官方)');
    expect(getPluginDisplayName({ id: 'builtin_QQ音乐 (官方)', name: 'QQ音乐 (官方)' })).toBe('QQ音乐 (官方)');

    await setLocale('ja');
    expect(getPluginDisplayName({ id: 'builtin_酷狗音乐 (官方)', name: '酷狗音乐 (官方)' })).toBe('酷狗音楽 (公式)');
    expect(getPluginDisplayName({ id: 'builtin_QQ音乐 (官方)', name: 'QQ音乐 (官方)' })).toBe('QQ音楽 (公式)');

    await setLocale('en');
    expect(getPluginDisplayName({ id: 'builtin_酷狗音乐 (官方)', name: '酷狗音乐 (官方)' })).toBe('Kugou Music (Official)');
    expect(getPluginDisplayName({ id: 'builtin_QQ音乐 (官方)', name: 'QQ音乐 (官方)' })).toBe('QQ Music (Official)');

    // Third-party plugins remain unchanged
    expect(getPluginDisplayName({ id: 'custom_123', name: '猫耳FM (广播剧)' })).toBe('猫耳FM (广播剧)');
  });

  it('translates official author name', async () => {
    await setLocale('zh-CN');
    expect(getPluginDisplayAuthor('WYY 官方')).toBe('WYY 官方');

    await setLocale('ja');
    expect(getPluginDisplayAuthor('WYY 官方')).toBe('WYY 公式');

    await setLocale('en');
    expect(getPluginDisplayAuthor('WYY 官方')).toBe('WYY Official');

    // Third party author unchanged
    expect(getPluginDisplayAuthor('社区作者小张')).toBe('社区作者小张');
  });

  it('translates official top list group titles', async () => {
    await setLocale('ja');
    expect(getTopListGroupTitle('QQ音乐官方排行榜')).toBe('QQ音楽公式ランキング');
    expect(getTopListGroupTitle('官方精选榜单')).toBe('公式おすすめランキング');

    await setLocale('en');
    expect(getTopListGroupTitle('QQ音乐官方排行榜')).toBe('QQ Music Official Charts');
    expect(getTopListGroupTitle('官方精选榜单')).toBe('Official Featured Charts');
  });

  it('translates specific chart items and descriptions', async () => {
    await setLocale('ja');
    const hotChart = getTopListDisplayInfo({ id: '26', title: '热歌榜', description: 'QQ音乐站内播放热度前300首' });
    expect(hotChart.title).toBe('ヒットチャート');
    expect(hotChart.description).toBe('QQ音楽内の再生数トップ300曲');

    const soaringChart = getTopListDisplayInfo({ id: '62', title: '飙升榜' });
    expect(soaringChart.title).toBe('急上昇チャート');

    const kugouTop = getTopListDisplayInfo({ title: '酷狗TOP500', description: '酷狗音乐热门歌曲' });
    expect(kugouTop.title).toBe('酷狗 TOP500');
    expect(kugouTop.description).toBe('酷狗音乐热门歌曲');
  });
});
