import { StyleSheet } from 'react-native-unistyles';

import { RING } from './constants';

export const styles = StyleSheet.create((theme) => ({
  ring: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    color: theme.colors.toastText,
    fontVariant: ['tabular-nums'],
  },
}));
