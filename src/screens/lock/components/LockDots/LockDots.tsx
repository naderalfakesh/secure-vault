import { View } from 'react-native';

import { PinDots } from '@/components/ui';

import { styles } from './LockDots.styles';

type LockDotsProps = {
  compact: boolean;
  lockedOut: boolean;
  filled: number;
  error: boolean;
  shake: number;
};

export function LockDots({ compact, lockedOut, filled, error, shake }: LockDotsProps) {
  return (
    <View
      style={[styles.dots(compact), lockedOut && styles.dimmed]}
      accessibilityElementsHidden={lockedOut}
      importantForAccessibility={lockedOut ? 'no-hide-descendants' : 'auto'}
      testID="lock-dots"
    >
      <PinDots filled={lockedOut ? 0 : filled} error={error && !lockedOut} shake={shake} />
    </View>
  );
}
