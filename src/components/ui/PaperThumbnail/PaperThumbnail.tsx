import { View } from 'react-native';

import { LINES } from './constants';
import { styles } from './PaperThumbnail.styles';
import type { PaperThumbnailProps } from './types';

/** Scanned-paper placeholder: the warmest colour on screen. */
export function PaperThumbnail({
  width = 44,
  height = 56,
  radius = 8,
  children,
}: PaperThumbnailProps) {
  return (
    <View
      style={[styles.paper, { width, height, borderRadius: radius }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children ?? (
        <View style={styles.lines}>
          {LINES.map((lineWidth, index) => (
            <View key={index} style={[styles.line, { width: lineWidth }]} />
          ))}
        </View>
      )}
    </View>
  );
}
