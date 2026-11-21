import { View } from 'react-native';

import { PinDots } from '@/components/ui';

import { styles } from './LockDots.styles';

type LockDotsProps = {
  compact: boolean;
  lockedOut: boolean;
  /** Digits entered so far. */
  filled: number;
  /** The dots flash red after a wrong PIN. */
  error: boolean;
  shake: number;
};

/** The PIN dots, below the header and outside its scroll, so they are always on screen (AX5). */
export function LockDots({ compact, lockedOut, filled, error, shake }: LockDotsProps) {
  return (
    <View
      style={[styles.dots(compact), lockedOut && styles.dimmed]}
      accessibilityElementsHidden={lockedOut}
      importantForAccessibility={lockedOut ? 'no-hide-descendants' : 'auto'}
      testID="lock-dots"
    >
      {/* A lockout shows empty dimmed dots (the Lock board), not the last wrong PIN's red. */}
      <PinDots filled={lockedOut ? 0 : filled} error={error && !lockedOut} shake={shake} />
    </View>
  );
}
