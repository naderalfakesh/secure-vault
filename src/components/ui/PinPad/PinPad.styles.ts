import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  pad: {
    alignSelf: 'center',
    direction: 'ltr',
  },
  row: {
    flexDirection: 'row',
  },
  key: (action: boolean, size: number) => ({
    width: size,
    height: size,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: action ? 'transparent' : theme.colors.surfaceMuted,
  }),
  pressed: (action: boolean) => ({
    backgroundColor: action ? theme.colors.surfaceMuted : theme.colors.borderStrong,
  }),
  disabled: { opacity: 0.32 },
}));
