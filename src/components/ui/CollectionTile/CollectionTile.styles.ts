import { StyleSheet } from 'react-native-unistyles';

import { pressedDim } from '../pressedStyles';

export const styles = StyleSheet.create((theme) => ({
  tile: {
    flex: 1,
    padding: theme.inset.roomy,
    gap: theme.inset.snug,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    minHeight: theme.touchTarget,
  },
  pressed: pressedDim(theme),
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  name: {
    flex: 1,
    fontWeight: '600',
  },
}));
