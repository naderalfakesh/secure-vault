import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  // Only as tall as its content, and shrinks (then scrolls) when space is short.
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bannerArea: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.warningMuted,
  },
  bannerText: {
    flex: 1,
  },
}));
