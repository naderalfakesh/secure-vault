import { StyleSheet } from 'react-native-unistyles';

import { pressedDim } from '../pressedStyles';

export const styles = StyleSheet.create((theme) => ({
  base: (outlined: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.inset.tight,
    minHeight: 36,
    paddingHorizontal: theme.inset.roomy,
    borderRadius: theme.radii.pill,
    borderWidth: outlined ? 1 : 0,
    borderColor: theme.colors.borderStrong,
  }),
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.inset.tight,
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
  pressed: pressedDim(theme),
}));
