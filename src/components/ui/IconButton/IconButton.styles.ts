import { StyleSheet } from 'react-native-unistyles';

import type { IconButtonVariant } from './types';

export const styles = StyleSheet.create((theme) => ({
  base: (variant: IconButtonVariant) => ({
    width: theme.touchTarget,
    height: theme.touchTarget,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(variant === 'tinted' && { backgroundColor: theme.colors.surfaceMuted }),
    ...(variant === 'filled' && { backgroundColor: theme.colors.primary }),
    ...(variant === 'glass' && {
      backgroundColor: theme.colors.stageGlass,
      borderWidth: 1,
      borderColor: theme.colors.stageGlassBorder,
    }),
  }),
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));
