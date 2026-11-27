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
    /** Shrink to avoid mid-word breaks at large text sizes; pass false for user-entered tokens. */
    fit?: boolean;
  }
>;
