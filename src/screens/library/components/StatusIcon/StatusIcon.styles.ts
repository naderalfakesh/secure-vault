import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  well: (fill: 'dangerMuted' | 'surfaceMuted') => ({
    width: 64,
    height: 64,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors[fill],
  }),
}));
