import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    gap: theme.spacing.lg,
  },
  title: {
    paddingHorizontal: theme.spacing.xxs,
  },
}));
