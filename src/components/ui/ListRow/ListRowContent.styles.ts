import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  tile: {
    width: theme.controlSize.iconTile,
    height: theme.controlSize.iconTile,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: theme.inset.hair,
  },
  value: {
    flexShrink: 1,
  },
}));
