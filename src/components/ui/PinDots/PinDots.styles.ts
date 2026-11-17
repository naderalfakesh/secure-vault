import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  dots: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    // PIN dots fill left to right in every language.
    direction: 'ltr',
  },
  dot: (state: 'empty' | 'filled' | 'error') => ({
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: state === 'empty' ? 1.5 : 0,
    borderColor: theme.colors.borderStrong,
    backgroundColor:
      state === 'error'
        ? theme.colors.danger
        : state === 'filled'
          ? theme.colors.textPrimary
          : 'transparent',
  }),
}));
