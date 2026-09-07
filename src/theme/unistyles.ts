import { StyleSheet } from 'react-native-unistyles';

import { breakpoints } from './breakpoints';
import { darkColors, lightColors } from './colors';
import { motion, radii, shadows, spacing, touchTarget } from './tokens';
import { typography } from './typography';

export const lightTheme = {
  colors: lightColors,
  spacing,
  radii,
  shadows,
  motion,
  typography,
  touchTarget,
} as const;

export const darkTheme = {
  ...lightTheme,
  colors: darkColors,
} as const;

type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  // Module augmentation requires interfaces; the empty bodies are the pattern Unistyles documents.
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints,
  settings: {
    // Follow the OS by default; Settings can pin light or dark later.
    adaptiveThemes: true,
  },
});
