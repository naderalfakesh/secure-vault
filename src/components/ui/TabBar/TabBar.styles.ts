import { StyleSheet } from 'react-native-unistyles';

import { TAB_BAR_HEIGHT } from './constants';

export const styles = StyleSheet.create((theme) => ({
  bar: {
    position: 'absolute',
    start: theme.spacing.lg,
    end: theme.spacing.lg,
    minHeight: TAB_BAR_HEIGHT,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.elevation.floating,
  },
  // Glass draws its own edge; the solid fill and the hairline go, the float shadow stays.
  glassBar: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  scan: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...theme.elevation.floating,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
