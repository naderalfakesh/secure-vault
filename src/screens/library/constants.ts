import type { SortOrder } from '@/features/documents/library';

export const ALL_EXPIRY_DAYS = 365 * 200;

export const SKELETON_DELAY_MS = 300;

export const SEARCH_DEBOUNCE_MS = 150;

export const SORTS: readonly SortOrder[] = ['newest', 'oldest', 'title', 'expiry'];

export const SKELETON_WIDTHS = [60, 52, 66] as const;
