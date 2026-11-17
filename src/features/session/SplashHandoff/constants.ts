import { darkColors, lightColors } from '@/theme/colors';

/**
 * The native splash draws its image 150 pt wide in the middle of the window,
 * and the mark fills 92 % of it (`scripts/brand/make-icons.mjs`).
 */
export const SPLASH_MARK = 138;
/** The cross-fade from the splash repaint to the screen underneath. */
export const HANDOFF_FADE_MS = 200;
/** Whatever happens to layout or timers, the overlay is gone this long after release. */
export const HANDOFF_FALLBACK_MS = 1500;
/** Two frames past the fade, so its last frame has been drawn before the overlay goes. */
export const HANDOFF_SETTLE_MS = 32;

/** The native splash backgrounds (app.json). */
export const SPLASH_BACKGROUND = {
  light: lightColors.background,
  dark: darkColors.background,
} as const;
