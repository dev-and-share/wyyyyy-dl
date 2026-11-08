import { t } from '../i18n';

/**
 * 获取插件在当前语言下的友好展示名称
 * 若为官方内置插件（QQ 音乐、酷狗官方），自动映射为当前界面语言
 */
export function getPluginDisplayName(pluginOrName: any): string {
  if (!pluginOrName) return '';
  const rawName = typeof pluginOrName === 'string' ? pluginOrName : (pluginOrName.name || pluginOrName.platform || '');
  const id = typeof pluginOrName === 'object' && pluginOrName !== null ? (pluginOrName.id || '') : '';

  const clean = rawName.replace(/\s+/g, '');

  if (id === 'builtin_酷狗音乐 (官方)' || clean === '酷狗音乐(官方)' || clean === '酷狗音乐' || id.includes('kugou') || id.includes('酷狗')) {
    return t('musicfree.pluginNameKugou');
  }

  if (id === 'builtin_QQ音乐 (官方)' || clean === 'QQ音乐(官方)' || clean === 'QQ音乐' || id.includes('qq') || id.includes('QQ')) {
    return t('musicfree.pluginNameQQ');
  }

  return rawName;
}

/**
 * 获取插件作者的本地化显示名称
 */
export function getPluginDisplayAuthor(authorOrPlugin: any): string {
  if (!authorOrPlugin) return t('musicfree.authorOpenSource');
  const author = typeof authorOrPlugin === 'string' ? authorOrPlugin : (authorOrPlugin.author || '');
  const clean = author.replace(/\s+/g, '');
  if (clean === 'WYY官方' || clean === 'WYY' || clean === '官方' || clean.toLowerCase() === 'wyy官方') {
    return t('musicfree.pluginAuthorWyy');
  }
  return author || t('musicfree.authorOpenSource');
}

/**
 * 获取官方排行榜分组标题的多语言显示
 */
export function getTopListGroupTitle(title: string): string {
  if (!title) return '';
  const clean = title.replace(/\s+/g, '');
  if (clean.includes('QQ音乐') || clean.includes('QQ音楽') || clean.toLowerCase().includes('qqmusic')) {
    return t('musicfree.chartGroupQQ');
  }
  if (clean.includes('酷狗') || clean.includes('官方精选榜单') || clean.toLowerCase().includes('kugou')) {
    return t('musicfree.chartGroupKugou');
  }
  return title;
}

/**
 * 获取排行榜条目标题与说明的本地化显示
 */
export function getTopListDisplayInfo(item: { id?: string | number; title?: string; name?: string; description?: string; intro?: string }): {
  title: string;
  description: string;
} {
  if (!item) return { title: '', description: '' };
  const rawTitle = item.title || item.name || '';
  const rawDesc = item.description || item.intro || '';

  // QQ 音乐内置榜单精细化映射
  if (item.id === '26' || rawTitle === '热歌榜') {
    return {
      title: t('musicfree.chartHot'),
      description: item.id === '26' ? t('musicfree.chartHotDesc') : rawDesc
    };
  }
  if (item.id === '27' || rawTitle === '新歌榜') {
    return {
      title: t('musicfree.chartNew'),
      description: item.id === '27' ? t('musicfree.chartNewDesc') : rawDesc
    };
  }
  if (item.id === '62' || rawTitle === '飙升榜') {
    return {
      title: t('musicfree.chartSoaring'),
      description: item.id === '62' ? t('musicfree.chartSoaringDesc') : rawDesc
    };
  }
  if (item.id === '4' || rawTitle === '流行指数榜') {
    return {
      title: t('musicfree.chartTrend'),
      description: item.id === '4' ? t('musicfree.chartTrendDesc') : rawDesc
    };
  }

  // 酷狗内置通用榜单映射
  if (rawTitle === '酷狗TOP500') {
    return {
      title: t('musicfree.chartKugouTop500'),
      description: rawDesc
    };
  }

  return {
    title: rawTitle,
    description: rawDesc
  };
}
