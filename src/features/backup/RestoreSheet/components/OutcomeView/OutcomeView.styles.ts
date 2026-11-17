import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  partialIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dangerMuted,
  },
}));
