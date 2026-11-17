import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  bodyScroll: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  dots: {
    marginTop: theme.spacing.md,
  },
  pad: (compact: boolean) => ({
    paddingTop: theme.spacing.xs,
    paddingBottom: compact ? theme.spacing.sm : theme.spacing.lg,
  }),
}));
