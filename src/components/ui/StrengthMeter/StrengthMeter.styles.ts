import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 18,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.xxs,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontWeight: '600',
  },
}));
