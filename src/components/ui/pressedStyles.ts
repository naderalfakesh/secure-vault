import type { lightTheme } from '@/theme';

type Theme = typeof lightTheme;

/** Cards, tiles, chips and the tab bar fade a little while pressed. */
export function pressedDim(theme: Theme) {
  return { opacity: theme.pressed.dim };
}

/** Rows fill with the muted surface while pressed. */
export function pressedFill(theme: Theme) {
  return { backgroundColor: theme.colors.surfaceMuted };
}
