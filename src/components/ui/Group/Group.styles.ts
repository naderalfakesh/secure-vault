import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.spacing.xs,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
  },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.group,
    overflow: 'hidden',
  },
  separator: (inset: 'edge' | 'content') => ({
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginStart:
      inset === 'content'
        ? theme.spacing.md + theme.controlSize.iconTile + theme.spacing.sm
        : theme.spacing.md,
  }),
  footer: {
    paddingHorizontal: theme.spacing.md,
  },
}));
