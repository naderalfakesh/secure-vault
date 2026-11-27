import { textScale } from '@/theme/tokens';
import type { TypographyVariant } from '@/theme/typography';

import type { TextTone } from './types';

export const toneToColor = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  inverse: 'onPrimary',
  accent: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const satisfies Record<TextTone, string>;

export const maxScale: Partial<Record<TypographyVariant, number>> = {
  largeTitle: textScale.largeTitleMax,
};

export const fitsByDefault: ReadonlySet<TypographyVariant> = new Set([
  'largeTitle',
  'title1',
  'title2',
  'title3',
]);
