import type { PropsWithChildren } from 'react';
import type { TextProps } from 'react-native';

import type { TypographyVariant } from '@/theme/typography';

export type TextTone =
  'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'success' | 'warning' | 'danger';

export type AppTextProps = PropsWithChildren<
  TextProps & {
    variant?: TypographyVariant;
    tone?: TextTone;
    align?: 'left' | 'center' | 'right';
    /**
     * Shrink to keep every word whole instead of breaking it mid-word at the
     * largest text sizes. On by default for the title variants; pass `false`
     * for user content, such as a document name, that may be one long token.
     */
    fit?: boolean;
  }
>;
