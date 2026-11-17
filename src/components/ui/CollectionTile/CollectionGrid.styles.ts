import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  grid: {
    gap: theme.spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  cell: {
    flex: 1,
  },
}));
