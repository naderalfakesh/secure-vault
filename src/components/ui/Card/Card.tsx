import { View } from 'react-native';

import { styles } from './Card.styles';
import type { CardProps } from './types';

export function Card({ children, padded = false, style, ...props }: CardProps) {
  return (
    <View {...props} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}
