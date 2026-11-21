import type { ListRowTint } from './types';

/** The icon tile's fill: the explicit tint, else danger, or primary. */
export function rowTint(tint: ListRowTint | undefined, destructive: boolean): ListRowTint {
  return tint ?? (destructive ? 'danger' : 'primary');
}

/** What a screen reader hears for the row: title, value, then subtitle. */
export function rowLabel(title: string, value?: string, subtitle?: string): string {
  return [title, value, subtitle].filter(Boolean).join(', ');
}
