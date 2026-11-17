import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  bodyScroll: {
    flex: 1,
  },
  body: (compact: boolean) => ({
    alignItems: 'center',
    paddingTop: compact ? theme.spacing.lg : theme.spacing.xxxl,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: 6,
  }),
  dots: (compact: boolean) => ({
    marginTop: compact ? theme.spacing.lg : 36,
  }),
  dimmed: {
    opacity: 0.35,
  },
  pad: (compact: boolean) => ({
    paddingBottom: compact ? theme.spacing.sm : theme.spacing.xl,
  }),
}));
