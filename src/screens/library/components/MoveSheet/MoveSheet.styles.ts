import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  // Sized to its content, scrolling only once the sheet reaches its maximum height.
  scroller: {
    flexGrow: 0,
    flexShrink: 1,
  },
  body: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
}));
