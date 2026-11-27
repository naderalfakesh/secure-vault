import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  ink: {
    color: theme.colors.onStage,
    textAlign: 'center',
  },
  dim: {
    color: theme.colors.onStageDim,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
}));
