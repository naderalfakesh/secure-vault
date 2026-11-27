import type { ListRowTint } from './types';

export function rowTint(tint: ListRowTint | undefined, destructive: boolean): ListRowTint {
  return tint ?? (destructive ? 'danger' : 'primary');
}

export function rowLabel(title: string, value?: string, subtitle?: string): string {
  return [title, value, subtitle].filter(Boolean).join(', ');
}
