import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  track: (vertical: boolean) => ({
    flexDirection: vertical ? 'column' : 'row',
    padding: 3,
    gap: 2,
    borderRadius: vertical ? theme.radii.lg : theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  }),
  // 38 pt segments; their hit slop reaches over the 3 pt track to 44 pt.
  // Stacked rows are full 44 pt targets of their own.
  segment: (selected: boolean, vertical: boolean) => ({
    flex: vertical ? undefined : 1,
    minHeight: vertical ? theme.touchTarget : theme.touchTarget - 6,
    paddingHorizontal: 14,
    borderRadius: vertical ? theme.radii.md : theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: vertical ? 'space-between' : 'center',
    gap: theme.spacing.xs,
    ...(selected && { backgroundColor: theme.colors.surface, ...theme.elevation.card }),
  }),
  label: (selected: boolean, vertical: boolean) => ({
    fontWeight: selected ? '600' : '400',
    flexShrink: 1,
    ...(vertical && { paddingVertical: theme.spacing.xs }),
  }),
  disabled: { opacity: 0.5 },
}));
