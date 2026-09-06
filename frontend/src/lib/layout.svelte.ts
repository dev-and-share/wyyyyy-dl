export type PcLayoutMode = 'desktop-sidebar' | 'legacy-tabs';

/** 统一 Cookie 变量：ui_mode = desktop | tabs | legacy */
const COOKIE_NAME = 'ui_mode';

function getCookieValue(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)ui_mode=([^;]+)/);
  return m?.[1] ?? null;
}

function setCookie(value: string) {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

function checkIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

export function getInitialPcLayout(): PcLayoutMode {
  const v = getCookieValue();
  // 'tabs' → 精简版；其余（'desktop' / 未设置）→ 桌面版
  if (v === 'tabs') return 'legacy-tabs';
  return 'desktop-sidebar';
}

export const layoutState = $state<{
  mode: PcLayoutMode;
  isDesktop: boolean;
}>({
  mode: getInitialPcLayout(),
  isDesktop: checkIsDesktop()
});

export function switchToLegacyTabs(): void {
  setCookie('tabs');
  layoutState.mode = 'legacy-tabs';
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function switchToDesktopSidebar(): void {
  setCookie('desktop');
  layoutState.mode = 'desktop-sidebar';
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function initLayoutWatcher(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleResize = () => {
    layoutState.isDesktop = window.innerWidth >= 1024;
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}
