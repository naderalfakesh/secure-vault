import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, type IconName, Screen, Text } from '@/components/ui';
import { attemptsLeft, lockRemainingMs } from '@/features/auth/lockout';
import { PinDots, PinKeypad } from '@/features/auth/PinPad';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';
import { useSecurityStatus } from '@/hooks/useSecurityStatus';

const biometryIcon: Record<string, IconName> = {
  faceId: 'faceId',
  touchId: 'fingerprint',
  biometrics: 'fingerprint',
};

const biometryLabel: Record<string, string> = {
  faceId: 'Face ID',
  touchId: 'Touch ID',
  biometrics: 'biometrics',
};

export default function LockScreen() {
  const { status, biometry, lockout, unlock, unlockWithPin, error } = useSession();
  const security = useSecurityStatus();
  const promptedRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [lockLeft, setLockLeft] = useState(0);
  const [wrong, setWrong] = useState(false);
  const hasBiometrics = biometry !== 'none';

  // Returning users get the biometric prompt as soon as the screen appears.
  useEffect(() => {
    if (status !== 'locked' || promptedRef.current || !hasBiometrics) return;
    promptedRef.current = true;
    unlock().catch(() => {});
  }, [status, hasBiometrics, unlock]);

  // Tick the lockout countdown while locked out.
  useEffect(() => {
    const update = () => setLockLeft(Math.ceil(lockRemainingMs(lockout, Date.now()) / 1000));
    update();
    if (lockRemainingMs(lockout, Date.now()) <= 0) return;
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lockout]);

  const {
    pin,
    error: flash,
    shake,
    press,
  } = usePinEntry({
    onComplete: (entered, { fail }) => {
      setChecking(true);
      unlockWithPin(entered)
        .then((ok) => {
          if (!ok) {
            setWrong(true);
            fail();
          }
        })
        .finally(() => setChecking(false));
    },
  });

  const lockedOut = lockLeft > 0;
  const message = lockedOut
    ? `Too many attempts. Try again in ${lockLeft}s.`
    : wrong
      ? `Wrong PIN. ${attemptsLeft(lockout)} attempts left before a pause.`
      : error
        ? error
        : hasBiometrics
          ? `Use ${biometryLabel[biometry] ?? 'biometrics'} or enter your PIN`
          : 'Enter your PIN';

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Icon name="lock" size={32} tone="accent" />
        </View>
        <Text variant="title1" align="center" accessibilityRole="header">
          SecureVault
        </Text>
        <Text
          variant="subheadline"
          tone={lockedOut || wrong || error ? 'danger' : 'secondary'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
        <View style={[styles.dots, lockedOut && styles.dimmed]}>
          <PinDots filled={pin.length} error={flash} shake={shake} />
        </View>
        {security.isSecure ? null : (
          <View style={styles.banner} accessibilityRole="alert">
            <Icon name="warning" size={16} tone="warning" />
            <Text variant="caption" tone="secondary" style={styles.bannerText}>
              This device looks rooted or modified. Your vault still works, but be careful.
            </Text>
          </View>
        )}
      </View>
      {hasBiometrics ? null : (
        <View style={styles.passcodeRow}>
          <Button
            label="Use device passcode"
            variant="ghost"
            size="md"
            onPress={() => unlock()}
            leading={<Icon name="unlock" size={16} tone="accent" />}
          />
        </View>
      )}
      <View style={[styles.pad, lockedOut && styles.dimmed]}>
        <PinKeypad
          onKey={(key) => {
            setWrong(false);
            press(key);
          }}
          onBiometric={hasBiometrics ? () => unlock() : undefined}
          biometricIcon={biometryIcon[biometry]}
          disabled={lockedOut || checking}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.xs,
  },
  dots: {
    marginTop: theme.spacing.md,
  },
  dimmed: {
    opacity: 0.4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.warningMuted,
  },
  bannerText: {
    flex: 1,
  },
  passcodeRow: {
    alignItems: 'center',
    paddingBottom: theme.spacing.xs,
  },
  pad: {
    paddingBottom: theme.spacing.lg,
  },
}));
