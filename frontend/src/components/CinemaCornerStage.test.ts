import { render } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import CinemaCornerStage from './CinemaCornerStage.svelte';
import { layoutState } from '../lib/layout.svelte';

describe('CinemaCornerStage', () => {
  beforeEach(() => {
    layoutState.wco.visible = false;
  });

  it('does not render by default when WCO is not visible', () => {
    const { queryByTestId } = render(CinemaCornerStage);
    expect(queryByTestId('cinema-corner-stage')).toBeNull();
  });

  it('renders when layoutState.wco.visible is true', () => {
    layoutState.wco.visible = true;
    const { getByTestId } = render(CinemaCornerStage);
    const el = getByTestId('cinema-corner-stage');
    expect(el).toBeDefined();
    expect(el.style.background).toContain('var(--cinema-corner-bg)');
    expect(el.style.zIndex).toBe('100060');
  });

  it('renders when alwaysVisible is true regardless of WCO', () => {
    layoutState.wco.visible = false;
    const { getByTestId } = render(CinemaCornerStage, {
      props: {
        alwaysVisible: true,
        zIndex: 50,
        height: '64px',
        opacity: 0.9
      }
    });
    const el = getByTestId('cinema-corner-stage');
    expect(el).toBeDefined();
    expect(el.style.zIndex).toBe('50');
    expect(el.style.height).toBe('64px');
    expect(el.style.opacity).toBe('0.9');
  });

  it('generates custom gradient when color or radius is passed', () => {
    const { getByTestId } = render(CinemaCornerStage, {
      props: {
        alwaysVisible: true,
        color: '#fffdf0',
        radiusX: 400,
        radiusY: 150
      }
    });
    const el = getByTestId('cinema-corner-stage');
    const styleAttr = el.getAttribute('style') || '';
    expect(styleAttr).toContain('400px 150px');
    expect(styleAttr).toContain('255, 253, 240');
  });
});
