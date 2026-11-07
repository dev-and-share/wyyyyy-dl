import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import WyyLogo from './WyyLogo.svelte';

describe('WyyLogo', () => {
  it('renders default static WYY and icon', () => {
    const { getByTestId, getByText } = render(WyyLogo);

    expect(getByTestId('wyy-logo')).toBeDefined();
    expect(getByTestId('wyy-logo-static-text').textContent?.trim()).toBe('WYY');
    expect(getByText('🎵')).toBeDefined();
  });

  it('renders marquee track containing full slogan Whatever You Yearn', () => {
    const { getByTestId } = render(WyyLogo);

    const track = getByTestId('wyy-logo-marquee-track');
    expect(track.textContent).toContain('Whatever You Yearn');
    expect(track.textContent).toContain('WYY');
  });

  it('handles optional click and enter key navigation', async () => {
    const handleClick = vi.fn();
    const { getByTestId } = render(WyyLogo, {
      props: {
        onclick: handleClick
      }
    });

    const logo = getByTestId('wyy-logo');
    await fireEvent.click(logo);
    expect(handleClick).toHaveBeenCalledTimes(1);

    await fireEvent.keyDown(logo, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
