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

export function setPwaUpdateAvailable(version?: string | null): void {
  globalUiState.hasPwaUpdate = true;
  if (version) {
    globalUiState.pwaUpdateVersion = version;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('wyy:pwa-update-available', (e: any) => {
    globalUiState.hasPwaUpdate = true;
    if (e?.detail?.version) {
      globalUiState.pwaUpdateVersion = e.detail.version;
    }
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
