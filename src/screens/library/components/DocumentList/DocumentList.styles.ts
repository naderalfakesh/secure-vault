import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  row: {
    marginHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  first: {
    borderTopStartRadius: theme.radii.group,
    borderTopEndRadius: theme.radii.group,
  },
  last: {
    borderBottomStartRadius: theme.radii.group,
    borderBottomEndRadius: theme.radii.group,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginStart: theme.spacing.md,
  },
}));
