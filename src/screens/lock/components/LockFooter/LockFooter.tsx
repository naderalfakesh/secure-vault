import { View } from 'react-native';

import { Button } from '@/components/ui';
import { biometryIcon, deviceUnlockLabel } from '@/features/auth/lockCopy';

import type { BiometryType } from '../../../../../modules/expo-vault';
import { styles } from './LockFooter.styles';

export type LockFooterProps = {
  compact: boolean;
  lockedOut: boolean;
  biometry: BiometryType;
  hasBiometrics: boolean;
  onUnlock: () => void;
};

/** The device's own unlock, under the keypad. */
export function LockFooter({
  compact,
  lockedOut,
  biometry,
  hasBiometrics,
  onUnlock,
}: LockFooterProps) {
  return (
    <View style={styles.footer(compact)}>
      {lockedOut ? (
        // The pause covers the PIN only; the device's own unlock stays open.
        <Button
          label={deviceUnlockLabel(biometry)}
          variant="tinted"
          icon={hasBiometrics ? biometryIcon(biometry) : 'unlock'}
          onPress={onUnlock}
        />
      ) : (
        // The device prompt takes biometrics or the passcode; the label says both.
        <Button label={deviceUnlockLabel(biometry)} variant="plain" size="md" onPress={onUnlock} />
      )}
    </View>
  );
}
