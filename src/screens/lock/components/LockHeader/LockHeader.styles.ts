import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  // Only as tall as its content, and shrinks (then scrolls) when space is short.
  heroScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  hero: (compact: boolean) => ({
    alignItems: 'center',
    paddingTop: compact ? theme.spacing.lg : theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
  }),
  title: {
    marginTop: theme.spacing.md,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.inset.tight,
    marginTop: theme.inset.tight,
    paddingHorizontal: theme.spacing.xs,
  },
  subtitleText: {
    flexShrink: 1,
  },
}));
