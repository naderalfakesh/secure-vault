import type { SortOrder } from '@/features/documents/library';

/** Every recorded expiry date, so sorting and filtering can use them. */
export const ALL_EXPIRY_DAYS = 365 * 200;

/** Skeleton rows only once loading takes longer than this. */
export const SKELETON_DELAY_MS = 300;

export const SEARCH_DEBOUNCE_MS = 150;

export const SORTS: readonly SortOrder[] = ['newest', 'oldest', 'title', 'expiry'];

/** Title widths of the skeleton rows, in percent; the meta line is two thirds of it. */
export const SKELETON_WIDTHS = [60, 52, 66] as const;

export const DAY_MS = 86_400_000;
