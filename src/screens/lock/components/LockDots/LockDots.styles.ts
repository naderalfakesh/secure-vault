import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  dots: (compact: boolean) => ({
    marginTop: compact ? theme.spacing.lg : 36,
    marginBottom: theme.spacing.md,
    flexShrink: 0,
  }),
  dimmed: {
    opacity: 0.35,
  },
}));
