import { StyleSheet } from 'react-native-unistyles';

import { breakpoints } from './breakpoints';
import { darkColors, lightColors } from './colors';
import {
  controlSize,
  elevation,
  inset,
  layout,
  motion,
  pressed,
  radii,
  sheetInset,
  spacing,
  touchTarget,
} from './tokens';
import { typography } from './typography';

export const lightTheme = {
  colors: lightColors,
  spacing,
  inset,
  layout,
  radii,
  sheetInset,
  elevation,
  motion,
  pressed,
  typography,
  touchTarget,
  controlSize,
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
    adaptiveThemes: true,
  },
});
