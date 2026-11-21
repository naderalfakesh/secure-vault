import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.inset.tight,
    minHeight: 20,
  },
  subtitleText: {
    flexShrink: 1,
  },
}));
