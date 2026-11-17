import type { TextTone } from '../Text';
import { tintFromTone } from './constants';
import type { ListRowTint } from './types';

/** The icon tile's fill: the explicit tint, else danger, the legacy tone, or primary. */
export function rowTint(
  tint: ListRowTint | undefined,
  destructive: boolean,
  iconTone: TextTone | undefined,
): ListRowTint {
  return (
    tint ?? (destructive ? 'danger' : iconTone ? (tintFromTone[iconTone] ?? 'neutral') : 'primary')
  );
}

/** What a screen reader hears for the row: title, value, then subtitle. */
export function rowLabel(title: string, value?: string, subtitle?: string): string {
  return [title, value, subtitle].filter(Boolean).join(', ');
}
