import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import WinampSkinStage from './WinampSkinStage.svelte';
import { DEFAULT_PALETTE } from './skinTypes';

describe('WinampSkinStage dynamic bitrate badge', () => {
  const baseProps = {
    playing: false,
    currentTime: 0,
    duration: 200,
    palette: DEFAULT_PALETTE
  };

  it('renders default 128K when track is null or empty', () => {
    const { getByTestId } = render(WinampSkinStage, {
      ...baseProps,
      track: null
    });
    const badge = getByTestId('winamp-bitrate-badge');
    expect(badge.textContent?.trim()).toBe('128K');
  });

  it('renders 320K when track.br is 320000', () => {
    const { getByTestId } = render(WinampSkinStage, {
      ...baseProps,
      track: {
        id: 101,
        name: '夜曲',
        artist: '周杰伦',
        br: 320000
      }
    });
    const badge = getByTestId('winamp-bitrate-badge');
    expect(badge.textContent?.trim()).toBe('320K');
  });

  it('renders FLAC when track.br is 999000 (lossless)', () => {
    const { getByTestId } = render(WinampSkinStage, {
      ...baseProps,
      track: {
        id: 102,
        name: '青花瓷',
        artist: '周杰伦',
        br: 999000
      }
    });
    const badge = getByTestId('winamp-bitrate-badge');
    expect(badge.textContent?.trim()).toBe('FLAC');
  });

  it('renders HI-RES when track.br is 1920000', () => {
    const { getByTestId } = render(WinampSkinStage, {
      ...baseProps,
      track: {
        id: 103,
        name: '晴天 (Hi-Res)',
        artist: '周杰伦',
        br: 1920000
      }
    });
    const badge = getByTestId('winamp-bitrate-badge');
    expect(badge.textContent?.trim()).toBe('HI-RES');
  });

  it('maps level="lossless" to FLAC if br is not provided', () => {
    const { getByTestId } = render(WinampSkinStage, {
      ...baseProps,
      track: {
        id: 104,
        name: '稻香',
        artist: '周杰伦',
        level: 'lossless'
      }
    });
    const badge = getByTestId('winamp-bitrate-badge');
    expect(badge.textContent?.trim()).toBe('FLAC');
  });

  it('maps level="exhigh" to 320K if br is not provided', () => {
    const { getByTestId } = render(WinampSkinStage, {
      ...baseProps,
      track: {
        id: 105,
        name: '搁浅',
        artist: '周杰伦',
        level: 'exhigh'
      }
    });
    const badge = getByTestId('winamp-bitrate-badge');
    expect(badge.textContent?.trim()).toBe('320K');
  });

  it('maps type="flac" to FLAC as audio format fallback', () => {
    const { getByTestId } = render(WinampSkinStage, {
      ...baseProps,
      track: {
        id: 106,
        name: '枫',
        artist: '周杰伦',
        type: 'flac'
      }
    });
    const badge = getByTestId('winamp-bitrate-badge');
    expect(badge.textContent?.trim()).toBe('FLAC');
  });
});
