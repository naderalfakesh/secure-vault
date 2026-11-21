import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  ink: {
    color: theme.colors.onStage,
  },
  bottomBar: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.stageGlass,
    borderWidth: 1,
    borderColor: theme.colors.stageGlassBorder,
  },
  pillLabel: {
    fontWeight: '600',
  },
}));
