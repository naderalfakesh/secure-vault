import type { Palette } from '@/theme/colors';

import type { ListRowTint } from './types';

export const tileColors: Record<ListRowTint, { fill: keyof Palette; glyph: keyof Palette }> = {
  primary: { fill: 'primary', glyph: 'onPrimary' },
  success: { fill: 'success', glyph: 'onSuccess' },
  // onPrimary passes AA contrast on warning (brass) in both themes.
  warning: { fill: 'warning', glyph: 'onPrimary' },
  danger: { fill: 'danger', glyph: 'onDanger' },
  neutral: { fill: 'surfaceMuted', glyph: 'textSecondary' },
};

export const ACTIVATION_ECHO_MS = 500;
