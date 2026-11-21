import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.inset.snug,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.inset.roomy,
    borderRadius: theme.radii.input,
  },
  text: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
}));
