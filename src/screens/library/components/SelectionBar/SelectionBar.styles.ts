import { StyleSheet } from 'react-native-unistyles';

import { TAB_BAR_HEIGHT } from '@/components/ui';

export const styles = StyleSheet.create((theme) => ({
  bar: {
    position: 'absolute',
    start: theme.spacing.lg,
    end: theme.spacing.lg,
    height: TAB_BAR_HEIGHT,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.elevation.floating,
  },
}));
