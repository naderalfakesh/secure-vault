import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, Mark, PinDots, PinPad, Screen, Text } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import {
  biometricKeyLabel,
  biometricSubtitle,
  biometryIcon,
  deviceUnlockLabel,
  formatCountdown,
  LOCKOUT_BODY,
  wrongPinMessage,
} from '@/features/auth/lockCopy';
import { attemptsLeft, lockRemainingMs } from '@/features/auth/lockout';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';
import { useSecurityStatus } from '@/hooks/useSecurityStatus';
import { t } from '@/i18n';

export default function LockScreen() {
  const { status, biometry, settings, lockout, unlock, unlockWithPin, error } = useSession();
  const security = useSecurityStatus();
  const promptedRef = useRef(false);
  const [checking, setChecking] = useState(false);
  const [lockLeft, setLockLeft] = useState(0);
  const [wrong, setWrong] = useState(false);
  // Biometric unlock off: the PIN comes first, and the device-unlock button
  // below still opens the system prompt for whoever wants it.
  const hasBiometrics = biometry !== 'none' && settings.biometricUnlock;

  // Returning users get the biometric prompt once, as soon as the screen appears.
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
    onComplete: (entered, { clear, fail }) => {
      setChecking(true);
      unlockWithPin(entered)
        .then((result) => {
          if (result === 'unlocked') return;
          setWrong(result === 'wrong-pin');
          if (result === 'wrong-pin') fail();
          else clear();
        })
        .finally(() => setChecking(false));
    },
  });

  const lockedOut = lockLeft > 0;
  const showWrong = wrong && !lockedOut;
  const showError = Boolean(error) && !lockedOut && !showWrong;
  const alerting = showWrong || showError;

  const title = lockedOut
    ? t('lock.lockoutTitle', { time: formatCountdown(lockLeft) })
    : t('lock.title');
  const subtitle = lockedOut
    ? LOCKOUT_BODY
    : showWrong
      ? wrongPinMessage(attemptsLeft(lockout))
      : showError
        ? (error as string)
        : hasBiometrics && pin.length === 0
          ? biometricSubtitle(biometry)
          : t('lock.enterPin');

  // iOS ignores live regions: speak a wrong PIN or an error, and the lockout
  // once when it begins (its body stays the same while the countdown ticks).
  useAnnouncement(lockedOut ? LOCKOUT_BODY : alerting ? subtitle : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.hero}>
        <Mark size={64} muted={lockedOut} />
        <Text variant="title2" align="center" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <View
          style={styles.subtitle}
          accessible
          accessibilityRole={alerting ? 'alert' : undefined}
          accessibilityLiveRegion={alerting ? 'assertive' : 'polite'}
          accessibilityLabel={subtitle}
        >
          {alerting ? <Icon name="warning" size={16} tone="danger" /> : null}
          <Text
            variant="subheadline"
            tone={alerting ? 'danger' : 'secondary'}
            align="center"
            style={styles.subtitleText}
          >
            {subtitle}
          </Text>
        </View>
        <View
          style={[styles.dots, lockedOut && styles.dimmed]}
          accessibilityElementsHidden={lockedOut}
          importantForAccessibility={lockedOut ? 'no-hide-descendants' : 'auto'}
        >
          <PinDots filled={pin.length} error={flash} shake={shake} />
        </View>
        {security.isSecure ? null : (
          <View style={styles.banner} accessibilityRole="alert">
            <Icon name="warning" size={16} tone="warning" />
            <Text variant="caption" tone="secondary" style={styles.bannerText}>
              {t('lock.insecureDevice')}
            </Text>
          </View>
        )}
      </View>
      <PinPad
        onKey={(key) => {
          setWrong(false);
          press(key);
        }}
        onBiometric={hasBiometrics && !lockedOut ? () => unlock() : undefined}
        biometricIcon={biometryIcon(biometry)}
        biometricLabel={biometricKeyLabel(biometry)}
        disabled={lockedOut}
        busy={checking}
      />
      <View style={styles.footer}>
        {lockedOut ? (
          // The pause covers the PIN only; the device's own unlock stays open.
          <Button
            label={deviceUnlockLabel(biometry)}
            variant="tinted"
            icon={hasBiometrics ? biometryIcon(biometry) : 'unlock'}
            onPress={() => unlock()}
          />
        ) : (
          // The device prompt takes biometrics or the passcode; the label says both.
          <Button
            label={deviceUnlockLabel(biometry)}
            variant="plain"
            size="md"
            onPress={() => unlock()}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    flex: 1,
    alignItems: 'center',
    paddingTop: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    marginTop: theme.spacing.md,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: theme.spacing.xs,
  },
  subtitleText: {
    flexShrink: 1,
  },
  dots: {
    marginTop: 36,
  },
  dimmed: {
    opacity: 0.35,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.warningMuted,
  },
  bannerText: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 20,
    marginBottom: theme.spacing.lg,
  },
}));
