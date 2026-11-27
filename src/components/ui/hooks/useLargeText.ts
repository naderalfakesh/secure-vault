import { useWindowDimensions } from 'react-native';

import { textScale } from '@/theme/tokens';

export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= textScale.accessibilityText;
}
