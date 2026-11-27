import type { lightTheme } from '@/theme';

type Theme = typeof lightTheme;

export function pressedDim(theme: Theme) {
  return { opacity: theme.pressed.dim };
}

export function pressedFill(theme: Theme) {
  return { backgroundColor: theme.colors.surfaceMuted };
}
