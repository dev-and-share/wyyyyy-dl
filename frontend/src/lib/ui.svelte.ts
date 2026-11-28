/**
 * Global UI store — bottom sheet, global drawer & theme control primitives.
 * Module-level $state acts as a singleton (Svelte 5 Runes equivalent of Redux store).
 */

import { getInitialTheme, applyTheme, type ThemeMode } from './theme';

export type SheetActionStyle = 'default' | 'primary' | 'danger' | 'cancel';

export type SheetAction = {
  label: string;
  style?: SheetActionStyle;
  onclick: () => void;
};

export type SheetData = {
  title: string;
  subtitle?: string;
  actions: SheetAction[];
};

// Single reactive source-of-truth for the active bottom sheet
export const sheetState = $state<{ data: SheetData | null }>({ data: null });

export function openSheet(data: SheetData): void {
  sheetState.data = data;
}

export function closeSheet(): void {
  sheetState.data = null;
}

// Global UI controls for settings drawer and theme
export const globalUiState = $state<{
  showSettings: boolean;
  themeMode: ThemeMode;
  hasPwaUpdate: boolean;
  pwaUpdateVersion: string | null;
}>({
  showSettings: false,
  themeMode: getInitialTheme(),
  hasPwaUpdate: false,
  pwaUpdateVersion: null
});

function normalizeUiVersion(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.startsWith('v') ? s : `v${s}`;
}

export function setPwaUpdateAvailable(version?: string | null): void {
  const norm = normalizeUiVersion(version);
  const current = typeof __APP_VERSION__ !== 'undefined' ? normalizeUiVersion(__APP_VERSION__) : null;
  if (norm && current && norm === current) {
    return;
  }
  globalUiState.hasPwaUpdate = true;
  if (norm) {
    globalUiState.pwaUpdateVersion = norm;
  }
}

export function clearPwaUpdateAvailable(): void {
  globalUiState.hasPwaUpdate = false;
  globalUiState.pwaUpdateVersion = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('wyy:pwa-update-available', (e: any) => {
    setPwaUpdateAvailable(e?.detail?.version);
  });
  window.addEventListener('wyy:pwa-update-cleared', () => {
    clearPwaUpdateAvailable();
  });
}

export function openSettings(): void {
  globalUiState.showSettings = true;
}

export function closeSettings(): void {
  globalUiState.showSettings = false;
}

export function toggleTheme(): void {
  const current = globalUiState.themeMode;
  const next = current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
  globalUiState.themeMode = next;
  applyTheme(next);
}

export function setThemeMode(mode: ThemeMode): void {
  globalUiState.themeMode = mode;
  applyTheme(mode);
}
