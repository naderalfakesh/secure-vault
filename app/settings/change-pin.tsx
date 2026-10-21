import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  Icon,
  PinDots,
  PinPad,
  Screen,
  Text,
  usePinPadMetrics,
  useToast,
} from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { formatCountdown, LOCKOUT_BODY } from '@/features/auth/lockCopy';
import { lockRemainingMs } from '@/features/auth/lockout';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';
import { type StringKey, t } from '@/i18n';

type Stage = 'current' | 'next' | 'confirm' | 'saving';

const titles: Record<Stage, StringKey> = {
  current: 'changePin.title.current',
  next: 'changePin.title.next',
  confirm: 'changePin.title.confirm',
  saving: 'changePin.title.saving',
};

const steps: Record<Stage, number> = { current: 1, next: 2, confirm: 3, saving: 3 };

export default function ChangePinScreen() {
  const { changePin, error, lockout } = useSession();
  const toast = useToast();
  const { compact } = usePinPadMetrics();
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
          setMessage(t('changePin.same'));
          helpers.fail();
          return;
        }
        setNext(entered);
        setStage('confirm');
        helpers.clear();
        return;
      }
      if (entered !== next) {
        setMessage(t('changePin.mismatch'));
        helpers.fail(() => setStage('next'));
        return;
      }
      setStage('saving');
      // The current PIN is checked once, here, together with the change.
      changePin(current, entered).then((result) => {
        if (result === 'changed') {
          toast.show({ message: t('changePin.changed'), tone: 'success' });
          router.back();
          return;
        }
        // A failure that is not a wrong PIN has its own sentence in the session error.
        if (result === 'wrong-pin') setMessage(t('changePin.wrongPin'));
        setStage('current');
        helpers.clear();
      });
    },
  });

  const lockedOut = lockLeft > 0 && stage === 'current';
  const alert = Boolean(message || error) && !lockedOut;
  const title = lockedOut
    ? t('lock.lockoutTitle', { time: formatCountdown(lockLeft) })
    : t(titles[stage]);
  const subtitle = lockedOut
    ? LOCKOUT_BODY
    : (message ?? error ?? (stage === 'current' ? null : t('changePin.untouched')));
  // iOS ignores live regions: speak errors, and the lockout once when it begins.
  useAnnouncement(lockedOut ? LOCKOUT_BODY : alert ? subtitle : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <View style={styles.cancel}>
          <Button
            label={t('common.cancel')}
            accessibilityHint={t('changePin.cancelHint')}
            variant="plain"
            size="md"
            onPress={() => router.back()}
            disabled={stage === 'saving'}
          />
        </View>
        <Text variant="subheadline" tone="secondary" style={styles.step}>
          {t('changePin.step', { step: steps[stage], total: 3 })}
        </Text>
        <View style={styles.cancel} />
      </View>
      {/* On a short window or at large text the prompt scrolls above the keypad. */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body(compact)}
        bounces={false}
        showsVerticalScrollIndicator={false}
        testID="pin-header"
      >
        <Text variant="title2" align="center" accessibilityRole="header">
          {title}
        </Text>
        <View
          style={styles.subtitle}
          accessible={Boolean(subtitle)}
          accessibilityRole={alert ? 'alert' : undefined}
          accessibilityLiveRegion={alert ? 'assertive' : 'polite'}
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
          style={[styles.dots(compact), lockedOut && styles.dimmed]}
          accessibilityElementsHidden={lockedOut}
          importantForAccessibility={lockedOut ? 'no-hide-descendants' : 'auto'}
        >
          <PinDots filled={pin.length} error={flash} shake={shake} />
        </View>
      </ScrollView>
      <View style={styles.pad(compact)}>
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
    minWidth: 72,
    alignItems: 'flex-start',
  },
  step: {
    fontWeight: '600',
  },
  bodyScroll: {
    flex: 1,
  },
  body: (compact: boolean) => ({
    alignItems: 'center',
    paddingTop: compact ? theme.spacing.lg : theme.spacing.xxxl,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: 6,
  }),
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
  dots: (compact: boolean) => ({
    marginTop: compact ? theme.spacing.lg : 36,
  }),
  dimmed: {
    opacity: 0.35,
  },
  pad: (compact: boolean) => ({
    paddingBottom: compact ? theme.spacing.sm : theme.spacing.xl,
  }),
}));
