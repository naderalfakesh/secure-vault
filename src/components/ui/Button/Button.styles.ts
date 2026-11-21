import { StyleSheet } from 'react-native-unistyles';

import type { ButtonSize } from './types';

export const styles = StyleSheet.create((theme) => ({
  base: (size: ButtonSize, plain: boolean) => ({
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: size === 'lg' ? theme.controlSize.buttonLarge : theme.controlSize.buttonMedium,
    paddingHorizontal: plain ? theme.spacing.xs : size === 'lg' ? theme.spacing.lg : 18,
    borderRadius: theme.radii.pill,
  }),
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.pressed.dim,
    transform: [{ scale: 0.98 }],
  },
}));
