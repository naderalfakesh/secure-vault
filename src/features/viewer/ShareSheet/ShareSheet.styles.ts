import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressLabel: {
    flex: 1,
  },
}));
