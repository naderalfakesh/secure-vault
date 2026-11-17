import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  tile: {
    flex: 1,
    padding: 14,
    gap: 10,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    minHeight: theme.touchTarget,
  },
  pressed: { opacity: 0.85 },
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
