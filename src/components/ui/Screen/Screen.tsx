import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from './Screen.styles';
import type { ScreenProps } from './types';

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
