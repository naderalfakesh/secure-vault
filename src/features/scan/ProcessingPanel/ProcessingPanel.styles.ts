import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  flex: {
    flex: 1,
  },
  thumbs: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.paper,
  },
  steps: {
    gap: theme.spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: theme.touchTarget,
  },
  actions: {
    gap: theme.spacing.sm,
  },
}));
