import { StyleSheet } from 'react-native-unistyles';

import { pressedDim } from '../pressedStyles';

export const styles = StyleSheet.create((theme) => ({
  card: (layout: 'rail' | 'grid') => ({
    width: layout === 'rail' ? 210 : undefined,
    flex: layout === 'grid' ? 1 : undefined,
    padding: theme.spacing.sm,
    gap: theme.inset.snug,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
  }),
  pressed: pressedDim(theme),
  thumbnail: (height: number) => ({
    height,
  }),
  body: {
    gap: theme.inset.hair,
  },
  title: {
    fontWeight: '600',
  },
  expiry: {
    fontWeight: '600',
  },
}));
