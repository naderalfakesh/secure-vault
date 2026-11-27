import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  tab: (selected: boolean) => ({
    flex: 1,
    minHeight: 56,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.inset.hair,
    backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
  }),
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
}));
