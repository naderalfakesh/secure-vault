import { StyleSheet } from 'react-native-unistyles';

import { PAPER_LINE } from './constants';

export const styles = StyleSheet.create((theme) => ({
  paper: {
    backgroundColor: theme.colors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  lines: {
    flex: 1,
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 7,
  },
  line: {
    height: 3,
    borderRadius: 2,
    backgroundColor: PAPER_LINE,
  },
}));
