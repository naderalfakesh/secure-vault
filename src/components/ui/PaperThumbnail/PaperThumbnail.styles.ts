import { StyleSheet } from 'react-native-unistyles';

// Page margins and line spacing sized to look like text on a small paper sheet, not layout steps.
const LINE_GAP = 5;
const PAGE_PADDING_Y = 9;
const PAGE_PADDING_X = 7;

export const styles = StyleSheet.create((theme) => ({
  paper: {
    backgroundColor: theme.colors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  lines: {
    flex: 1,
    gap: LINE_GAP,
    paddingVertical: PAGE_PADDING_Y,
    paddingHorizontal: PAGE_PADDING_X,
  },
  line: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.paperLine,
  },
}));
