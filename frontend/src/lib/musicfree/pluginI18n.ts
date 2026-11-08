import { t } from '../i18n';

/**
 * 获取插件在当前语言下的友好展示名称
 * 若为官方内置插件（QQ 音乐、酷狗官方），自动映射为当前界面语言
 */
export function getPluginDisplayName(pluginOrName: any): string {
  if (!pluginOrName) return '';
  const name = typeof pluginOrName === 'string' ? pluginOrName : (pluginOrName.name || pluginOrName.platform || '');
  const id = typeof pluginOrName === 'object' && pluginOrName !== null ? (pluginOrName.id || '') : '';

  if (id === 'builtin_酷狗音乐 (官方)' || name === '酷狗音乐 (官方)') {
    return t('musicfree.pluginNameKugou');
  }

  if (id === 'builtin_QQ音乐 (官方)' || name === 'QQ音乐 (官方)') {
    return t('musicfree.pluginNameQQ');
  }

  return name;
}

/**
 * 获取插件作者的本地化显示名称
 */
export function getPluginDisplayAuthor(authorOrPlugin: any): string {
  if (!authorOrPlugin) return t('musicfree.authorOpenSource');
  const author = typeof authorOrPlugin === 'string' ? authorOrPlugin : (authorOrPlugin.author || '');
  if (author === 'WYY 官方' || author === 'WYY' || author === '官方') {
    return t('musicfree.pluginAuthorWyy');
  }
  return author || t('musicfree.authorOpenSource');
}

/**
 * 获取官方排行榜分组标题的多语言显示
 */
export function getTopListGroupTitle(title: string): string {
  if (!title) return '';
  if (title === 'QQ音乐官方排行榜' || title.includes('QQ音乐官方排行榜')) {
    return t('musicfree.chartGroupQQ');
  }
  if (title === '官方精选榜单' || title.includes('官方精选榜单')) {
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
