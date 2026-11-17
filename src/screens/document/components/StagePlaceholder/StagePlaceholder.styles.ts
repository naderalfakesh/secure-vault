import { StyleSheet } from 'react-native-unistyles';

import { STAGE_INK_DIM } from '../../constants';

export const styles = StyleSheet.create((theme) => ({
  dim: {
    color: STAGE_INK_DIM,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderPage: {
    width: 260,
    height: 340,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
}));
