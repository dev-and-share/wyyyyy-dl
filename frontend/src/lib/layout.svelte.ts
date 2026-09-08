/**
 * 布局状态管理 (Layout State)
 * 纯粹响应式：宽屏 (>= 1024px) 桌面侧边栏模式，窄屏 (< 1024px) 移动端优化模式
 */

function checkIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

export const layoutState = $state<{
  isDesktop: boolean;
}>({
  isDesktop: checkIsDesktop()
});

export function initLayoutWatcher(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleResize = () => {
    layoutState.isDesktop = window.innerWidth >= 1024;
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}
