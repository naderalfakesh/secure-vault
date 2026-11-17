import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  erase: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  eraseIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dangerMuted,
  },
  link: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontWeight: '600',
  },
}));
