import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  stage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.viewerStage,
  },
}));
