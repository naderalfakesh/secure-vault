import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  header: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xxs,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chips: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.layout.titleMargin,
    paddingTop: theme.spacing.xs,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.layout.titleMargin,
  },
}));
