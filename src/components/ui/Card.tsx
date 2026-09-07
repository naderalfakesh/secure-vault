import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type CardProps = PropsWithChildren<ViewProps & { padded?: boolean }>;

/** Grouped surface for rows and content; the settings and detail screens are built from these. */
export function Card({ children, padded = false, style, ...props }: CardProps) {
  return (
    <View {...props} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  padded: {
    padding: theme.spacing.md,
  },
}));
