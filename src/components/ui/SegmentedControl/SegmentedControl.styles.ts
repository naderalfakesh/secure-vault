import { StyleSheet } from 'react-native-unistyles';

const TRACK_PADDING = 3;

export const styles = StyleSheet.create((theme) => ({
  track: (vertical: boolean) => ({
    flexDirection: vertical ? 'column' : 'row',
    padding: TRACK_PADDING,
    gap: theme.inset.hair,
    borderRadius: vertical ? theme.radii.lg : theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  }),
  segment: (selected: boolean, vertical: boolean) => ({
    flex: vertical ? undefined : 1,
    minHeight: vertical ? theme.touchTarget : theme.touchTarget - 6,
    paddingHorizontal: theme.inset.roomy,
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
