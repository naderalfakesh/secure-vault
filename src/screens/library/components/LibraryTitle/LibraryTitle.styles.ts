import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingStart: theme.layout.titleMargin,
    paddingEnd: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    minHeight: 52,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
  },
}));
