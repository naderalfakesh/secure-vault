import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  dim: {
    color: theme.colors.onStageDim,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderPage: {
    width: 260,
    height: 340,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.stageGlassFaint,
  },
}));
