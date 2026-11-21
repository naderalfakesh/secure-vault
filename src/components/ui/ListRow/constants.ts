import type { Palette } from '@/theme/colors';

import type { ListRowTint } from './types';

export const tileColors: Record<ListRowTint, { fill: keyof Palette; glyph: keyof Palette }> = {
  primary: { fill: 'primary', glyph: 'onPrimary' },
  success: { fill: 'success', glyph: 'onSuccess' },
  // Brass has no "on" colour of its own; onPrimary passes AA on it in both modes.
  warning: { fill: 'warning', glyph: 'onPrimary' },
  danger: { fill: 'danger', glyph: 'onDanger' },
  neutral: { fill: 'surfaceMuted', glyph: 'textSecondary' },
};

/** A press this soon after a screen reader's activation is the same activation. */
export const ACTIVATION_ECHO_MS = 500;
