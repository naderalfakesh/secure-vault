import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  row: {
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  hero: {
    backgroundColor: theme.colors.primaryMuted,
  },
  denied: {
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accentMuted,
  },
  deniedAction: {
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
  },
  footerText: {
    flex: 1,
  },
}));
