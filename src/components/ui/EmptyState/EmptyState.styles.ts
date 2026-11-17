import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.xs,
  },
  description: {
    maxWidth: 320,
  },
  actions: {
    marginTop: theme.spacing.sm,
    alignSelf: 'stretch',
    gap: theme.spacing.xs,
  },
}));
