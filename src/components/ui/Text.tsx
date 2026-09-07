import type { PropsWithChildren } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import type { TypographyVariant } from '@/theme/typography';

export type TextTone =
  'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'success' | 'warning' | 'danger';

export type AppTextProps = PropsWithChildren<
  TextProps & {
    variant?: TypographyVariant;
    tone?: TextTone;
    align?: 'left' | 'center' | 'right';
  }
>;

const toneToColor = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  inverse: 'textInverse',
  accent: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

/**
 * The only text primitive screens should use. Variants map to the platform
 * text styles so font scaling stays on; tones map to semantic theme colors.
 */
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  align,
  style,
  ...props
}: AppTextProps) {
  const { theme } = useUnistyles();
  const color = theme.colors[toneToColor[tone]];

  return (
    <NativeText
      maxFontSizeMultiplier={2}
      {...props}
      style={[theme.typography[variant], { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </NativeText>
  );
}
