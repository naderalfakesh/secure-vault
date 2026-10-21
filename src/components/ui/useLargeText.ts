import { useWindowDimensions } from 'react-native';

import { textScale } from '@/theme/tokens';

/**
 * True at the accessibility text sizes (iOS AX1 and up, Android's largest
 * font), where rows stack their value under the title and bars cap labels.
 */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= textScale.accessibilityText;
}
