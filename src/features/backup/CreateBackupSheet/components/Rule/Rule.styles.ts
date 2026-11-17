import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 22,
  },
  // Rules wrap at the largest text sizes instead of running off the sheet.
  ruleText: {
    flexShrink: 1,
  },
}));
