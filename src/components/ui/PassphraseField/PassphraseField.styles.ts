import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  field: {
    gap: theme.inset.tight,
  },
  label: {
    fontWeight: '600',
    marginHorizontal: theme.spacing.xxs,
  },
  box: (state: 'idle' | 'focused' | 'error') => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 52,
    paddingStart: theme.inset.roomy,
    paddingEnd: theme.spacing.xxs,
    borderRadius: theme.radii.input,
    borderWidth: 1.5,
    borderColor:
      state === 'error'
        ? theme.colors.danger
        : state === 'focused'
          ? theme.colors.primary
          : 'transparent',
    backgroundColor: theme.colors.surfaceMuted,
  }),
  solid: (state: 'idle' | 'focused' | 'error') => ({
    backgroundColor: theme.colors.surface,
    ...(state === 'idle' && { borderColor: theme.colors.border }),
  }),
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    writingDirection: 'auto',
    paddingVertical: theme.spacing.sm,
  },
  toggle: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    marginHorizontal: theme.spacing.xxs,
  },
  errorText: {
    flex: 1,
  },
}));
