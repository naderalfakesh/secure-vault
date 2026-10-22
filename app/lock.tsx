import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  Icon,
  Mark,
  PinDots,
  PinPad,
  Screen,
  Text,
  usePinPadMetrics,
} from '@/components/ui';
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
import { textScale } from '@/theme/tokens';

export default function LockScreen() {
  const { status, biometry, settings, lockout, unlock, unlockWithPin, error } = useSession();
  const security = useSecurityStatus();
  const { compact } = usePinPadMetrics();
  const promptedRef = useRef(false);
  const [checking, setChecking] = useState(false);
  // Read the lockout on the first render, so the first frame under the
  // fading splash already shows the right squircle.
  const [lockLeft, setLockLeft] = useState(() =>
    Math.ceil(lockRemainingMs(lockout, Date.now()) / 1000),
  );
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
      {/* The header takes what the keypad leaves; on a short window or at large
        text it scrolls instead of sliding under the keys. The dots sit below
        it, outside the scroll, so they are always on screen (AX5). */}
      <View style={styles.top}>
        <ScrollView
          style={styles.heroScroll}
          contentContainerStyle={styles.hero(compact)}
          bounces={false}
          showsVerticalScrollIndicator={false}
          testID="lock-header"
        >
          <Mark size={64} muted={lockedOut} glyph={lockedOut ? 'clock' : 'mark'} />
          {/* Capped, and fitted so no word breaks: at AX5 it was clipped mid-word. */}
          <Text
            variant="title2"
            align="center"
            accessibilityRole="header"
            maxFontSizeMultiplier={textScale.barTitleMax}
            style={styles.title}
          >
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
              maxFontSizeMultiplier={textScale.barTitleMax}
              fit
              style={styles.subtitleText}
            >
              {subtitle}
            </Text>
          </View>
        </ScrollView>
        <View
          style={[styles.dots(compact), lockedOut && styles.dimmed]}
          accessibilityElementsHidden={lockedOut}
          importantForAccessibility={lockedOut ? 'no-hide-descendants' : 'auto'}
          testID="lock-dots"
        >
          {/* A lockout shows empty dimmed dots (the Lock board), not the last wrong PIN's red. */}
          <PinDots filled={lockedOut ? 0 : pin.length} error={flash && !lockedOut} shake={shake} />
        </View>
        {security.isSecure ? null : (
          <ScrollView
            style={styles.heroScroll}
            contentContainerStyle={styles.bannerArea}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.banner} accessibilityRole="alert">
              <Icon name="warning" size={16} tone="warning" />
              <Text variant="caption" tone="secondary" style={styles.bannerText}>
                {t('lock.insecureDevice')}
              </Text>
            </View>
          </ScrollView>
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
      <View style={styles.footer(compact)}>
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
  top: {
    flex: 1,
  },
  // Only as tall as its content, and shrinks (then scrolls) when space is short.
  heroScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  hero: (compact: boolean) => ({
    alignItems: 'center',
    paddingTop: compact ? theme.spacing.lg : theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
  }),
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
  dots: (compact: boolean) => ({
    marginTop: compact ? theme.spacing.lg : 36,
    marginBottom: theme.spacing.md,
    flexShrink: 0,
  }),
  dimmed: {
    opacity: 0.35,
  },
  bannerArea: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.warningMuted,
  },
  bannerText: {
    flex: 1,
  },
  footer: (compact: boolean) => ({
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: compact ? theme.spacing.xs : 20,
    marginBottom: compact ? theme.spacing.xs : theme.spacing.lg,
  }),
}));
