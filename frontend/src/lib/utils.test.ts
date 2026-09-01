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
