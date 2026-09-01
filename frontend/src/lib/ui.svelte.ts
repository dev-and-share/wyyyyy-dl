/**
 * Global UI store — bottom sheet & future overlay primitives.
 * Module-level $state acts as a singleton (Svelte 5 Runes equivalent of Redux store).
 */

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
