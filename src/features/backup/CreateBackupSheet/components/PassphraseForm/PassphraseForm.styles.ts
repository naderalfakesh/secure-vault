import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  rules: {
    gap: theme.spacing.xxs,
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 22,
  },
  // Wraps at the largest text sizes instead of running off the sheet.
  matchText: {
    flexShrink: 1,
  },
}));
