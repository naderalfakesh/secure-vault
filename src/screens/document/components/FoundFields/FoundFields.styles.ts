import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.inset.tight,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
}));
