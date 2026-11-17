import { textScale } from '@/theme/tokens';
import type { TypographyVariant } from '@/theme/typography';

import type { TextTone } from './types';

/** The theme colour for each text tone; Icon uses the same map. */
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

/** Variants that stop growing at a ceiling, as the iOS large title does. */
export const maxScale: Partial<Record<TypographyVariant, number>> = {
  largeTitle: textScale.largeTitleMax,
};

/** Titles and headings fit their words by default. */
export const fitsByDefault: ReadonlySet<TypographyVariant> = new Set([
  'largeTitle',
  'title1',
  'title2',
  'title3',
]);
