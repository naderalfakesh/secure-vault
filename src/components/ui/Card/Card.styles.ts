import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.group,
    overflow: 'hidden',
  },
  padded: {
    padding: theme.spacing.md,
  },
}));
