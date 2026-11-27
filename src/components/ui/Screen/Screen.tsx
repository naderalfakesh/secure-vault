import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from './Screen.styles';
import type { ScreenProps } from './types';

// Background lives on core View (not SafeAreaView) so Unistyles repaints it on theme changes.
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
