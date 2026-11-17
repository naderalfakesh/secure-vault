import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: theme.spacing.xs,
  },
  side: {
    minWidth: 96,
    alignItems: 'flex-start',
  },
  end: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  stackedSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  stackedTitle: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
}));
