import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tick } from 'svelte';
import DesktopPlaylistGallery from './DesktopPlaylistGallery.svelte';
import { myPlaylists, recordPlaylistPlay, playlistPlayCounts } from '../../lib/playlist.svelte';

describe('DesktopPlaylistGallery Session Freeze & UI Stability Contracts', () => {
  beforeEach(() => {
    myPlaylists.length = 0;
    for (const key of Object.keys(playlistPlayCounts)) {
      delete playlistPlayCounts[key];
    }
  });

  it('renders gallery cards, displays 🔥 badge, and preserves card layout stability without jitter upon playback', async () => {
    myPlaylists.push(
      { id: 999, name: '我喜欢的音乐', specialType: 5, subscribed: false },
      { id: 101, name: '歌单 A', trackCount: 10, subscribed: false },
      { id: 102, name: '歌单 B', trackCount: 20, subscribed: false }
    );

    // Initial plays: A has 5 plays, B has 4 plays
    for (let i = 0; i < 5; i++) recordPlaylistPlay(101);
    for (let i = 0; i < 4; i++) recordPlaylistPlay(102);

    const onSelectPlaylist = vi.fn();
    const onPlayPlaylist = vi.fn();
    const showToast = vi.fn();

    const { getByTestId, queryByTestId, container } = render(DesktopPlaylistGallery, {
      props: {
        onSelectPlaylist,
        onPlayPlaylist,
        showToast
      }
    });

    // Both cards rendered
    const cardA = getByTestId('gallery-card-101');
    const cardB = getByTestId('gallery-card-102');
    expect(cardA).toBeDefined();
    expect(cardB).toBeDefined();

    // Verify initial play counts
    const countA = getByTestId('gallery-playcount-101');
    const countB = getByTestId('gallery-playcount-102');
    expect(countA.textContent).toContain('🔥 5');
    expect(countB.textContent).toContain('🔥 4');

    // Initial order: Card A is before Card B because 5 > 4
    let cards = container.querySelectorAll('[data-testid^="gallery-card-1"]');
    expect(cards[0].getAttribute('data-testid')).toBe('gallery-card-101');
    expect(cards[1].getAttribute('data-testid')).toBe('gallery-card-102');

    // User plays Card B two times: B increases from 4 to 6 (surpassing A's 5)
    recordPlaylistPlay(102);
    recordPlaylistPlay(102);
    await tick();

    // 1. Instant value feedback: Card B badge immediately updates from 4 to 6
    expect(getByTestId('gallery-playcount-102').textContent).toContain('🔥 6');

    // 2. Session Freeze / No UI Jitter: Card B does NOT jump in front of Card A!
    cards = container.querySelectorAll('[data-testid^="gallery-card-1"]');
    expect(cards[0].getAttribute('data-testid')).toBe('gallery-card-101');
    expect(cards[1].getAttribute('data-testid')).toBe('gallery-card-102');

    // 3. Deferred Re-sort: When user switches filter tab or triggers refresh, new order takes effect
    const createdTab = getByTestId('gallery-tab-created');
    await fireEvent.click(createdTab);
    cards = container.querySelectorAll('[data-testid^="gallery-card-1"]');
    expect(cards[0].getAttribute('data-testid')).toBe('gallery-card-102');
    expect(cards[1].getAttribute('data-testid')).toBe('gallery-card-101');
  });

  it('renders local playlist tab and switches to local playlists gallery', async () => {
    myPlaylists.push(
      { id: 201, name: '云端线上歌单', trackCount: 15, subscribed: false }
    );
    const { localPlaylistState } = await import('../../lib/localPlaylistStore.svelte');
    localPlaylistState.playlists = [
      { id: 'local_fav_test', name: '本地我喜欢的音乐', trackCount: 5, isLocal: true },
      { id: 'local_dance', name: '本地电音舞曲', trackCount: 12, isLocal: true }
    ];

    const onSelectPlaylist = vi.fn();
    const { getByTestId, queryByTestId, getByText, queryByText } = render(DesktopPlaylistGallery, {
      props: {
        onSelectPlaylist,
        showToast: vi.fn()
      }
    });

    const localTab = getByTestId('gallery-tab-local');
    expect(localTab).toBeDefined();
    expect(localTab.textContent).toContain('2');

    // In All tab, both cloud and local playlists are visible
    expect(getByTestId('gallery-card-201')).toBeDefined();
    expect(getByTestId('gallery-card-local_dance')).toBeDefined();

    // Click Local tab
    await fireEvent.click(localTab);
    await tick();

    // Now only local playlists are rendered
    expect(getByTestId('gallery-card-local_dance')).toBeDefined();
    expect(queryByTestId('gallery-card-201')).toBeNull();

    // Click local card
    await fireEvent.click(getByTestId('gallery-card-local_dance'));
    expect(onSelectPlaylist).toHaveBeenCalledWith('local_dance');
  });

  it('reactively updates gallery when playlists are loaded asynchronously after initial mount', async () => {
    const { getByTestId, queryByTestId } = render(DesktopPlaylistGallery, {
      props: {
        onSelectPlaylist: vi.fn(),
        showToast: vi.fn()
      }
    });

    // Initially empty state rendered
    expect(queryByTestId('gallery-card-301')).toBeNull();

    // Playlists arrive asynchronously (e.g. from backend network request)
    myPlaylists.push(
      { id: 301, name: '新同步的歌单', trackCount: 8, subscribed: false }
    );
    await tick();

    // Gallery should reactively display the newly loaded card
    expect(getByTestId('gallery-card-301')).toBeDefined();
  });
});
