import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  host: {
    position: 'absolute',
    start: theme.spacing.md,
    end: theme.spacing.md,
    alignItems: 'center',
  },
  toast: (danger: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    width: '100%',
    minHeight: 52,
    paddingVertical: theme.spacing.xs,
    paddingStart: theme.spacing.md,
    paddingEnd: theme.spacing.xs,
    borderRadius: theme.radii.toast,
    backgroundColor: danger ? theme.colors.toastDangerBg : theme.colors.toastBg,
    ...theme.elevation.sheet,
  }),
  message: {
    flex: 1,
    paddingVertical: theme.spacing.xxs,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  action: {
    minHeight: theme.touchTarget,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    justifyContent: 'center',
  },
  actionLabel: {
    color: theme.colors.toastAction,
    fontWeight: '600',
  },
}));
