import { describe, it, expect } from 'vitest';
import { formatArtist } from './utils';

describe('formatArtist', () => {
  it('handles null and undefined values safely', () => {
    expect(formatArtist(null)).toBe('');
    expect(formatArtist(undefined)).toBe('');
    expect(formatArtist('null')).toBe('');
    expect(formatArtist('NULL')).toBe('');
    expect(formatArtist('undefined')).toBe('');
    expect(formatArtist('   ')).toBe('');
  });

  it('formats clean artist strings', () => {
    expect(formatArtist('周杰伦')).toBe('周杰伦');
  });

  it('formats artist array correctly and removes null items', () => {
    expect(formatArtist([{ name: '周杰伦' }, { name: '方文山' }])).toBe('周杰伦/方文山');
    expect(formatArtist([{ name: 'null' }, { name: '周杰伦' }])).toBe('周杰伦');
    expect(formatArtist([{ id: 0, name: null }])).toBe('');
    expect(formatArtist(['周杰伦', null, '方文山'])).toBe('周杰伦/方文山');
  });

  it('formats track objects correctly', () => {
    expect(formatArtist({ artists: 'null' })).toBe('');
    expect(formatArtist({ artists: '周杰伦' })).toBe('周杰伦');
    expect(formatArtist({ ar: [{ name: '周杰伦' }] })).toBe('周杰伦');
    expect(formatArtist({ ar_name: '周杰伦' })).toBe('周杰伦');
  });
});

import { showToast, toastState } from './toast.svelte';

describe('showToast anti-spam protection', () => {
  it('deduplicates identical messages and caps active toasts to at most 3', () => {
    toastState.toasts = [];

    // 发送 20 条相同的消息
    for (let i = 0; i < 20; i++) {
      showToast('🛡️ 已跳过试听曲目《エルフ》', 'info');
    }
    // 必须去重，只保留 1 条
    expect(toastState.toasts).toHaveLength(1);
    expect(toastState.toasts[0].msg).toBe('🛡️ 已跳过试听曲目《エルフ》');

    // 发送 10 条不同的消息
    for (let i = 0; i < 10; i++) {
      showToast(`提示消息 ${i}`, 'info');
    }
    // 屏幕上最多同时展示 3 条
    expect(toastState.toasts.length).toBeLessThanOrEqual(3);
  });
});

import { matchesKeyword } from './utils';

describe('matchesKeyword with pinyin and text search', () => {
  it('matches plain substring case-insensitively', () => {
    expect(matchesKeyword('周杰伦', '周')).toBe(true);
    expect(matchesKeyword('晴天', '晴天')).toBe(true);
    expect(matchesKeyword('Shivers', 'shiv')).toBe(true);
    expect(matchesKeyword('Shivers', 'SHIV')).toBe(true);
  });

  it('matches pinyin initials (简拼/首字母)', () => {
    expect(matchesKeyword('周杰伦', 'zjl')).toBe(true);
    expect(matchesKeyword('周杰伦', 'ZJL')).toBe(true);
    expect(matchesKeyword('晴天', 'qt')).toBe(true);
    expect(matchesKeyword('我喜欢的音乐', 'wxh')).toBe(true);
    expect(matchesKeyword('我喜欢的音乐', 'wxhd')).toBe(true);
  });

  it('matches pinyin full spell (全拼)', () => {
    expect(matchesKeyword('周杰伦', 'zhoujielun')).toBe(true);
    expect(matchesKeyword('晴天', 'qingtian')).toBe(true);
    expect(matchesKeyword('夜曲', 'yequ')).toBe(true);
  });

  it('returns false when no match', () => {
    expect(matchesKeyword('周杰伦', 'cxk')).toBe(false);
    expect(matchesKeyword('晴天', 'rain')).toBe(false);
  });

  it('handles null, undefined and empty gracefully', () => {
    expect(matchesKeyword(null, 'zjl')).toBe(false);
    expect(matchesKeyword('晴天', null)).toBe(false);
    expect(matchesKeyword('晴天', '')).toBe(true);
    expect(matchesKeyword('', 'zjl')).toBe(false);
  });
});

import { formatCoverUrl, DEFAULT_VINYL_COVER } from './utils';

describe('formatCoverUrl NetEase CDN optimizations', () => {
  it('returns DEFAULT_VINYL_COVER for empty or invalid inputs', () => {
    expect(formatCoverUrl(null)).toBe(DEFAULT_VINYL_COVER);
    expect(formatCoverUrl(undefined)).toBe(DEFAULT_VINYL_COVER);
    expect(formatCoverUrl('')).toBe(DEFAULT_VINYL_COVER);
    expect(formatCoverUrl('null')).toBe(DEFAULT_VINYL_COVER);
    expect(formatCoverUrl('undefined')).toBe(DEFAULT_VINYL_COVER);
  });

  it('preserves local paths and data URIs', () => {
    expect(formatCoverUrl('/favicon.png')).toBe('/favicon.png');
    expect(formatCoverUrl('data:image/svg+xml;utf8,test')).toBe('data:image/svg+xml;utf8,test');
    expect(formatCoverUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123');
  });

  it('upgrades http to https and appends param size for NetEase CDN URLs', () => {
    expect(formatCoverUrl('http://p1.music.126.net/abc.jpg', 300)).toBe('https://p1.music.126.net/abc.jpg?param=300y300');
    expect(formatCoverUrl('https://p2.music.126.net/xyz.jpg', 120)).toBe('https://p2.music.126.net/xyz.jpg?param=120y120');
    expect(formatCoverUrl('http://p1.music.126.net/abc.jpg?param=100y100', 500)).toBe('https://p1.music.126.net/abc.jpg?param=500y500');
  });
});


