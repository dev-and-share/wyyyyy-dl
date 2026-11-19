import { render } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import { tick } from 'svelte';
import CinemaCornerStage from './CinemaCornerStage.svelte';
import { layoutState } from '../lib/layout.svelte';
import { pushModalBackdrop } from '../lib/skinStore.svelte';

describe('CinemaCornerStage', () => {
  beforeEach(() => {
    layoutState.wco.visible = false;
  });

  it('does not render by default when WCO is not visible', () => {
    const { queryByTestId } = render(CinemaCornerStage);
    expect(queryByTestId('cinema-corner-stage')).toBeNull();
  });

  it('renders when layoutState.wco.visible is true and controls opacity based on modal backdrop', async () => {
    layoutState.wco.visible = true;
    const { getByTestId } = render(CinemaCornerStage);
    const el = getByTestId('cinema-corner-stage');
    expect(el).toBeDefined();
    expect(el.style.background).toContain('var(--cinema-corner-bg)');
    expect(el.style.zIndex).toBe('100060');
    // 无弹窗常态：透明度为 0，杜绝在顶层遮盖正常 Logo 与控制按钮
    expect(el.style.opacity).toBe('0');

    // 唤起浮层遮罩：透明度激活为 1，展开柔焦漫反射
    const release = pushModalBackdrop();
    await tick();
    expect(el.style.opacity).toBe('1');

    release();
    await tick();
    expect(el.style.opacity).toBe('0');
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
