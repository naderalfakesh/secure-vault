import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create((theme) => ({
  footer: (compact: boolean) => ({
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: compact ? theme.spacing.xs : 20,
    marginBottom: compact ? theme.spacing.xs : theme.spacing.lg,
  }),
}));
