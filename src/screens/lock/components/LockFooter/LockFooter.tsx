import { View } from 'react-native';

import { Button } from '@/components/ui';
import { biometryIcon, deviceUnlockLabel } from '@/features/auth/lockCopy';
import type { BiometryType } from '@modules/expo-vault';

import { styles } from './LockFooter.styles';

type LockFooterProps = {
  compact: boolean;
  lockedOut: boolean;
  biometry: BiometryType;
  hasBiometrics: boolean;
  onUnlock: () => void;
};

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
        // PIN lockout does not block device biometric/passcode unlock.
        <Button
          label={deviceUnlockLabel(biometry)}
          variant="tinted"
          icon={hasBiometrics ? biometryIcon(biometry) : 'unlock'}
          onPress={onUnlock}
        />
      ) : (
        <Button label={deviceUnlockLabel(biometry)} variant="plain" size="md" onPress={onUnlock} />
      )}
    </View>
  );
}
