import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  form: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  thumbs: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: theme.radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.paper,
    overflow: 'hidden',
  },
  placeholder: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
    padding: theme.spacing.xxs,
  },
  input: {
    minHeight: theme.touchTarget + 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    textAlign: 'auto',
    writingDirection: 'auto',
    ...theme.typography.body,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  found: {
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
  },
  actions: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
}));
