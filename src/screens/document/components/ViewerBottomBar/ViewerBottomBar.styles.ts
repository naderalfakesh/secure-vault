import { StyleSheet } from 'react-native-unistyles';

import { STAGE_INK } from '../../constants';

export const styles = StyleSheet.create((theme) => ({
  ink: {
    color: STAGE_INK,
  },
  bottomBar: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillLabel: {
    fontWeight: '600',
  },
}));
