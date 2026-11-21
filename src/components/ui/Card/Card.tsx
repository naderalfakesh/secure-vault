import { View } from 'react-native';

import { styles } from './Card.styles';
import type { CardProps } from './types';

/**
 * Grouped surface for rows and content, styled like a Group (surface, radius
 * 20, no outline). Prefer Group for lists of rows.
 */
export function Card({ children, padded = false, style, ...props }: CardProps) {
  return (
    <View {...props} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}
