import { StyleSheet } from 'react-native-unistyles';

import { pressedDim } from '../pressedStyles';
import { TAB_BAR_HEIGHT } from './constants';

export const styles = StyleSheet.create((theme) => ({
  bar: {
    position: 'absolute',
    start: theme.spacing.lg,
    end: theme.spacing.lg,
    minHeight: TAB_BAR_HEIGHT,
    paddingVertical: theme.inset.tight,
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
  pressed: { ...pressedDim(theme), transform: [{ scale: theme.pressed.scale }] },
}));
