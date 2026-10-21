import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, PinDots, PinPad, Screen, Text, useToast } from '@/components/ui';
import { formatCountdown, LOCKOUT_BODY } from '@/features/auth/lockCopy';
import { lockRemainingMs } from '@/features/auth/lockout';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';

type Stage = 'current' | 'next' | 'confirm' | 'saving';

const titles: Record<Stage, string> = {
  current: 'Enter your current PIN',
  next: 'Choose a new PIN',
  confirm: 'Enter the new PIN again',
  saving: 'Saving the new PIN',
};

const steps: Record<Stage, number> = { current: 1, next: 2, confirm: 3, saving: 3 };

const UNTOUCHED = 'Your documents aren’t touched. Only the way in changes.';

export default function ChangePinScreen() {
  const { changePin, error, lockout } = useSession();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [lockLeft, setLockLeft] = useState(0);

  // While the PIN is paused on the lock screen, it is paused here too.
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
    onComplete: (entered, helpers) => {
      setMessage(null);
      if (stage === 'current') {
        setCurrent(entered);
        setStage('next');
        helpers.clear();
        return;
      }
      if (stage === 'next') {
        if (entered === current) {
          setMessage('Choose a PIN that’s different from your current one.');
          helpers.fail();
          return;
        }
        setNext(entered);
        setStage('confirm');
        helpers.clear();
        return;
      }
      if (entered !== next) {
        setMessage('The PINs didn’t match. Start again.');
        helpers.fail(() => setStage('next'));
        return;
      }
      setStage('saving');
      // The current PIN is checked once, here, together with the change.
      changePin(current, entered).then((result) => {
        if (result === 'changed') {
          toast.show({ message: 'PIN changed', tone: 'success' });
          router.back();
          return;
        }
        // A failure that is not a wrong PIN has its own sentence in the session error.
        if (result === 'wrong-pin') setMessage('Wrong PIN. Nothing was changed.');
        setStage('current');
        helpers.clear();
      });
    },
  });

  const lockedOut = lockLeft > 0 && stage === 'current';
  const alert = Boolean(message || error) && !lockedOut;
  const title = lockedOut ? `Try again in ${formatCountdown(lockLeft)}` : titles[stage];
  const subtitle = lockedOut
    ? LOCKOUT_BODY
    : (message ?? error ?? (stage === 'current' ? null : UNTOUCHED));

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityHint="Leaves your PIN as it is"
          onPress={() => router.back()}
          disabled={stage === 'saving'}
          style={styles.cancel}
        >
          <Text variant="body" tone={stage === 'saving' ? 'tertiary' : 'accent'}>
            Cancel
          </Text>
        </Pressable>
        <Text variant="subheadline" tone="secondary" style={styles.step}>
          {`Step ${steps[stage]} of 3`}
        </Text>
        <View style={styles.cancel} />
      </View>
      <View style={styles.body}>
        <Text variant="title2" align="center" accessibilityRole="header">
          {title}
        </Text>
        <View
          style={styles.subtitle}
          accessible={Boolean(subtitle)}
          accessibilityRole={alert ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
          accessibilityLabel={subtitle ?? undefined}
        >
          {alert ? <Icon name="warning" size={16} tone="danger" /> : null}
          {subtitle ? (
            <Text
              variant="subheadline"
              tone={alert ? 'danger' : 'secondary'}
              align="center"
              style={styles.subtitleText}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View
          style={[styles.dots, lockedOut && styles.dimmed]}
          accessibilityElementsHidden={lockedOut}
          importantForAccessibility={lockedOut ? 'no-hide-descendants' : 'auto'}
        >
          <PinDots filled={pin.length} error={flash} shake={shake} />
        </View>
      </View>
      <View style={styles.pad}>
        <PinPad onKey={press} disabled={lockedOut} busy={stage === 'saving'} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
  },
  cancel: {
    minWidth: 64,
    minHeight: theme.touchTarget,
    justifyContent: 'center',
  },
  step: {
    fontWeight: '600',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
    gap: 6,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 20,
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
  pad: {
    paddingBottom: theme.spacing.xl,
  },
}));
