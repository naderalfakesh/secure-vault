import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
  },
  // Equal sides keep the step count centred whether or not Back is shown.
  side: {
    minWidth: 72,
    alignItems: 'flex-start',
  },
  step: {
    fontWeight: '600',
  },
}));
