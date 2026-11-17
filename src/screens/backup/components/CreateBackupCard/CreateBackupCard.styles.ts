import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
  },
  centred: {
    textAlign: 'center',
  },
}));
