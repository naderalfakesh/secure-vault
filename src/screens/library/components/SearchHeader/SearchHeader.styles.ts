import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  block: {
    paddingBottom: theme.spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  searchField: {
    flex: 1,
  },
  trustLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.inset.tight,
    paddingHorizontal: theme.layout.titleMargin,
    paddingTop: theme.inset.snug,
  },
}));
