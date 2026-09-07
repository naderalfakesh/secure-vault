import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

export type ScreenProps = PropsWithChildren<
  ViewProps & {
    /** Safe-area edges to pad. Tabs and headers usually own top or bottom. */
    edges?: readonly Edge[];
    padded?: boolean;
  }
>;

/**
 * Themed page container; every route renders inside one. The background sits
 * on a core View so Unistyles can repaint it on theme changes; SafeAreaView is
 * a third-party view and only handles the insets.
 */
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  padded = false,
  style,
  ...props
}: ScreenProps) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={edges} style={styles.safe}>
        <View {...props} style={[styles.content, padded && styles.padded, style]}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: theme.spacing.md,
  },
}));
