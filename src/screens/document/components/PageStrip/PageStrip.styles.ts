import { StyleSheet } from 'react-native-unistyles';

import { STRIP_SELECTED } from '../../constants';

export const styles = StyleSheet.create((theme) => ({
  strip: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  stripPage: (selected: boolean) => ({
    width: 44,
    height: 58,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: theme.colors.paper,
    borderWidth: 2,
    borderColor: selected ? STRIP_SELECTED : 'transparent',
    opacity: selected ? 1 : 0.6,
  }),
  stripImage: {
    width: '100%',
    height: '100%',
  },
}));
