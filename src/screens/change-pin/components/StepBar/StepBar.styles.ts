import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
  },
  cancel: {
    minWidth: 72,
    alignItems: 'flex-start',
  },
  step: {
    fontWeight: '600',
  },
}));
