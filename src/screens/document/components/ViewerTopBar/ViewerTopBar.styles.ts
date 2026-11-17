import { StyleSheet } from 'react-native-unistyles';

import { STAGE_INK, STAGE_INK_DIM } from '../../constants';

export const styles = StyleSheet.create((theme) => ({
  ink: {
    color: STAGE_INK,
  },
  dim: {
    color: STAGE_INK_DIM,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
}));
