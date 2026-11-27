import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  scroller: {
    flexGrow: 0,
    flexShrink: 1,
  },
  body: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
}));
