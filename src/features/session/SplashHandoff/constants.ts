import { darkColors, lightColors } from '@/theme/colors';

// Matches native splash image (150 pt * 92% from scripts/brand/make-icons.mjs).
export const SPLASH_MARK = 138;
export const HANDOFF_FADE_MS = 200;
export const HANDOFF_FALLBACK_MS = 1500;
export const HANDOFF_SETTLE_MS = 32;

export const SPLASH_BACKGROUND = {
  light: lightColors.background,
  dark: darkColors.background,
} as const;
