import { View } from 'react-native';

import { decorative } from '../a11y';
import { LINES } from './constants';
import { styles } from './PaperThumbnail.styles';
import type { PaperThumbnailProps } from './types';

export function PaperThumbnail({
  width = 44,
  height = 56,
  radius = 8,
  children,
  testID,
}: PaperThumbnailProps) {
  return (
    <View
      style={[styles.paper, { width, height, borderRadius: radius }]}
      {...decorative}
      testID={testID}
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
