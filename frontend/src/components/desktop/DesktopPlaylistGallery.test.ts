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
});
