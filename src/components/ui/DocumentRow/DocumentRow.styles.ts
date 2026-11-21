import { StyleSheet } from 'react-native-unistyles';

import { pressedFill } from '../pressedStyles';

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 76,
    paddingVertical: theme.inset.snug,
    paddingHorizontal: theme.spacing.md,
  },
  selected: { backgroundColor: theme.colors.primaryMuted },
  pressed: pressedFill(theme),
  check: (on: boolean) => ({
    width: 26,
    height: 26,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: on ? 0 : 1.5,
    borderColor: theme.colors.borderStrong,
    backgroundColor: on ? theme.colors.primary : 'transparent',
  }),
  body: {
    flex: 1,
    gap: theme.inset.hair,
  },
  mark: {
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.accentMuted,
  },
}));
