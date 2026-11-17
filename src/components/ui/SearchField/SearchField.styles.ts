import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    writingDirection: 'auto',
    paddingVertical: theme.spacing.xs,
  },
  clear: {
    width: 18,
    height: 18,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
  },
}));
