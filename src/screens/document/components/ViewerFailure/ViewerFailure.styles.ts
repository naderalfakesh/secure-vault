import { StyleSheet } from 'react-native-unistyles';

const LIFT_ABOVE_BARS = 120;

export const styles = StyleSheet.create((theme) => ({
  failure: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
    paddingBottom: LIFT_ABOVE_BARS,
  },
  failureIcon: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
}));
