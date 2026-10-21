import type { PropsWithChildren } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { textScale } from '@/theme/tokens';
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
  inverse: 'onPrimary',
  accent: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

/** Variants that stop growing at a ceiling, as the iOS large title does. */
const maxScale: Partial<Record<TypographyVariant, number>> = {
  largeTitle: textScale.largeTitleMax,
};

/**
 * The only text primitive screens should use. Variants map to the platform
 * text styles so font scaling stays on, uncapped up to the largest
 * accessibility size (AX5, §10.2), except the large title, which stops at
 * 1.6× so a screen title never breaks one letter per line; tones map to semantic theme colors.
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
      maxFontSizeMultiplier={maxScale[variant]}
      {...props}
      style={[theme.typography[variant], { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </NativeText>
  );
}
