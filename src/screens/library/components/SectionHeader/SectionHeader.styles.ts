import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget,
    paddingHorizontal: theme.layout.titleMargin,
  },
  title: {
    flexShrink: 1,
  },
}));
