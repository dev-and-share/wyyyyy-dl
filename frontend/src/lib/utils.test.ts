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
