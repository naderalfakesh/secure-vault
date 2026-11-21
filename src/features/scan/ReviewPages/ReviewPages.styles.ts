import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.spacing.md,
    columnGap: theme.spacing.sm,
  },
  cell: {
    width: '31%',
    gap: theme.spacing.xs,
  },
  page: {
    aspectRatio: 0.75,
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.paper,
    overflow: 'hidden',
  },
  pageMoving: {
    borderColor: theme.colors.primary,
  },
  image: {
    flex: 1,
  },
  remove: {
    position: 'absolute',
    top: -theme.spacing.sm,
    end: -theme.spacing.sm,
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    backgroundColor: 'transparent',
  },
  addLabel: {
    fontWeight: '600',
  },
  pressed: {
    opacity: theme.pressed.dimIcon,
  },
  moveBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
}));
