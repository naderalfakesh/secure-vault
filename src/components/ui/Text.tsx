import { Children, type PropsWithChildren, type ReactNode } from 'react';
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
    /**
     * Shrink to keep every word whole instead of breaking it mid-word at the
     * largest text sizes. On by default for the title variants; pass `false`
     * for user content, such as a document name, that may be one long token.
     */
    fit?: boolean;
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

/** Titles and headings fit their words by default. */
const fitsByDefault: ReadonlySet<TypographyVariant> = new Set([
  'largeTitle',
  'title1',
  'title2',
  'title3',
]);

/** The plain text of `children`, or null when it holds anything but text. */
function plainText(children: ReactNode): string | null {
  let text = '';
  for (const child of Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number') text += String(child);
    else return null;
  }
  return text;
}

/**
 * Props that keep every word of `text` whole. Wrapping alone breaks a
 * word that is wider than the line ("Libra/ry" at AX5), so the text gets one
 * line per word at most and `adjustsFontSizeToFit` shrinks it until it fits
 * them: a word broken across lines would need more lines than that. Null for
 * empty text.
 */
export function wholeWordFit(
  text: string,
  numberOfLines?: number,
): { numberOfLines: number; adjustsFontSizeToFit: true; minimumFontScale: number } | null {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  if (words === 0) return null;
  return {
    numberOfLines: numberOfLines ?? words,
    adjustsFontSizeToFit: true,
    minimumFontScale: textScale.fitMinScale,
  };
}

/**
 * The only text primitive screens should use. Variants map to the platform
 * text styles so font scaling stays on, uncapped up to the largest
 * accessibility size (AX5), except the large title, which stops at
 * 1.3×. Titles also shrink to keep their words whole (`fit`); tones map to
 * semantic theme colors.
 */
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  align,
  fit,
  style,
  ...props
}: AppTextProps) {
  const { theme } = useUnistyles();
  const color = theme.colors[toneToColor[tone]];
  const text = (fit ?? fitsByDefault.has(variant)) ? plainText(children) : null;
  const fitProps = text === null ? null : wholeWordFit(text, props.numberOfLines);

  return (
    <NativeText
      maxFontSizeMultiplier={maxScale[variant]}
      {...props}
      {...fitProps}
      style={[theme.typography[variant], { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </NativeText>
  );
}
