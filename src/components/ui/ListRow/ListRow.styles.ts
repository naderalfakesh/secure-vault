import { StyleSheet } from 'react-native-unistyles';

import { pressedFill } from '../pressedStyles';

export const styles = StyleSheet.create((theme) => ({
  row: (hasSubtitle: boolean, divider: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: hasSubtitle ? 60 : 52,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: theme.colors.border,
  }),
  pressed: pressedFill(theme),
}));
