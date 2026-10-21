/**
 * System fonts on purpose: SF Pro and Roboto scale with Dynamic Type and font
 * scaling without shipping font files (handover §3.2). Sizes follow the iOS
 * text styles; the platform applies its own optical tracking, so only the
 * uppercase section label sets letter spacing.
 */
import type { TextStyle } from 'react-native';

export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  /** Uppercase section header. */
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  /** PIN keypad digits; tabular so the keys never shift. */
  pinDigit: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
