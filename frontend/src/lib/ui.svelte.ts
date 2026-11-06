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
}>({
  showSettings: false,
  themeMode: getInitialTheme()
});

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
