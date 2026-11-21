import { View } from 'react-native';

import { PinPad, Screen, usePinPadMetrics, useAnnouncement } from '@/components/ui';
import { useLockoutCountdown } from '@/features/auth/hooks/useLockoutCountdown';
import { biometricKeyLabel, biometryIcon, LOCKOUT_BODY } from '@/features/auth/lockCopy';
import { attemptsLeft } from '@/features/auth/lockout';
import { useSession } from '@/features/session/SessionProvider';
import { useDeviceIntegrity } from '@/hooks/useDeviceIntegrity';

import { InsecureBanner, LockDots, LockFooter, LockHeader } from './components';
import { lockMessage } from './helpers';
import { useBiometricPrompt } from './hooks/useBiometricPrompt';
import { usePinUnlock } from './hooks/usePinUnlock';
import { styles } from './LockScreen.styles';

export function LockScreen() {
  const { status, biometry, settings, lockout, unlock, unlockWithPin, error } = useSession();
  const deviceIntact = useDeviceIntegrity();
  const { compact } = usePinPadMetrics();
  // Biometric unlock off: the PIN comes first, and the device-unlock button
  // below still opens the system prompt for whoever wants it.
  const hasBiometrics = biometry !== 'none' && settings.biometricUnlock;

  useBiometricPrompt(status, hasBiometrics, unlock);
  const lockLeft = useLockoutCountdown(lockout);
  const entry = usePinUnlock(unlockWithPin);

  const { lockedOut, alerting, title, subtitle } = lockMessage({
    lockLeft,
    wrong: entry.wrong,
    error,
    attemptsLeft: attemptsLeft(lockout),
    hasBiometrics,
    biometry,
    pinLength: entry.pin.length,
  });

  // iOS ignores live regions: speak a wrong PIN or an error, and the lockout
  // once when it begins (its body stays the same while the countdown ticks).
  useAnnouncement(lockedOut ? LOCKOUT_BODY : alerting ? subtitle : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      {/* The header takes what the keypad leaves; on a short window or at large
        text it scrolls instead of sliding under the keys. The dots sit below
        it, outside the scroll, so they are always on screen (AX5). */}
      <View style={styles.top}>
        <LockHeader
          compact={compact}
          lockedOut={lockedOut}
          alerting={alerting}
          title={title}
          subtitle={subtitle}
        />
        <LockDots
          compact={compact}
          lockedOut={lockedOut}
          filled={entry.pin.length}
          error={entry.flash}
          shake={entry.shake}
        />
        {deviceIntact ? null : <InsecureBanner />}
      </View>
      <PinPad
        onKey={entry.onKey}
        onBiometric={hasBiometrics && !lockedOut ? () => unlock() : undefined}
        biometricIcon={biometryIcon(biometry)}
        biometricLabel={biometricKeyLabel(biometry)}
        disabled={lockedOut}
        busy={entry.checking}
      />
      <LockFooter
        compact={compact}
        lockedOut={lockedOut}
        biometry={biometry}
        hasBiometrics={hasBiometrics}
        onUnlock={() => unlock()}
      />
    </Screen>
  );
}
