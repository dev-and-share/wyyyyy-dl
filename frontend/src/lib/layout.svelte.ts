export type PcLayoutMode = 'desktop-sidebar' | 'legacy-tabs';

const STORAGE_KEY_PC_LAYOUT = 'wyyyy_pc_layout';

export function getInitialPcLayout(): PcLayoutMode {
  if (typeof localStorage === 'undefined') return 'desktop-sidebar';
  const v = localStorage.getItem(STORAGE_KEY_PC_LAYOUT);
  if (v === 'legacy-tabs') return 'legacy-tabs';
  return 'desktop-sidebar';
}

function checkIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

export const layoutState = $state<{
  mode: PcLayoutMode;
  isDesktop: boolean;
}>({
  mode: getInitialPcLayout(),
  isDesktop: checkIsDesktop()
});

export function switchToLegacyTabs(): void {
  try {
    localStorage.setItem(STORAGE_KEY_PC_LAYOUT, 'legacy-tabs');
  } catch {}
  layoutState.mode = 'legacy-tabs';
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function switchToDesktopSidebar(): void {
  try {
    localStorage.setItem(STORAGE_KEY_PC_LAYOUT, 'desktop-sidebar');
  } catch {}
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
