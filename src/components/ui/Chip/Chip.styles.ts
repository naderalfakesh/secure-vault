import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  base: (outlined: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs + 2,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    borderWidth: outlined ? 1 : 0,
    borderColor: theme.colors.borderStrong,
  }),
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs + 2,
    flexShrink: 1,
  },
  label: {
    fontWeight: '500',
  },
  remove: {
    width: 24,
    height: 24,
    marginEnd: -theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
}));
