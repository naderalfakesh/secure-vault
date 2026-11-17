import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  card: (layout: 'rail' | 'grid') => ({
    width: layout === 'rail' ? 210 : undefined,
    flex: layout === 'grid' ? 1 : undefined,
    padding: theme.spacing.sm,
    gap: 10,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
  }),
  pressed: { opacity: 0.85 },
  thumbnail: (height: number) => ({
    height,
  }),
  body: {
    gap: 2,
  },
  title: {
    fontWeight: '600',
  },
  expiry: {
    fontWeight: '600',
  },
}));
