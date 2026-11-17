import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  headerSide: {
    minWidth: theme.touchTarget,
    flexShrink: 0,
    alignItems: 'flex-start',
  },
  headerEnd: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  stackedTitle: {
    alignItems: 'center',
  },
  textButton: {
    minHeight: theme.touchTarget,
    minWidth: theme.touchTarget,
    justifyContent: 'center',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
}));
