import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, Screen, Text, useToast } from '@/components/ui';
import { PinDots, PinKeypad } from '@/features/auth/PinPad';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';

type Stage = 'current' | 'next' | 'confirm' | 'saving';

const titles: Record<Stage, string> = {
  current: 'Enter your current PIN',
  next: 'Choose a new PIN',
  confirm: 'Enter the new PIN again',
  saving: 'Saving',
};

export default function ChangePinScreen() {
  const { changePin, error } = useSession();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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
          setMessage('Choose a PIN different from the current one.');
          helpers.fail();
          return;
        }
        setNext(entered);
        setStage('confirm');
        helpers.clear();
        return;
      }
      if (entered !== next) {
        setMessage('The PINs did not match. Start again.');
        helpers.fail(() => setStage('next'));
        return;
      }
      setStage('saving');
      changePin(current, entered).then((ok) => {
        if (ok) {
          toast.show({ message: 'PIN changed', tone: 'success' });
          router.back();
          return;
        }
        setMessage('The current PIN was wrong.');
        setStage('current');
        helpers.clear();
      });
    },
  });

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Change PIN' }} />
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="lock" size={28} tone="accent" />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {titles[stage]}
        </Text>
        <Text
          variant="subheadline"
          tone={message || error ? 'danger' : 'secondary'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {message ?? error ?? 'Six digits.'}
        </Text>
        <View style={styles.dots}>
          <PinDots filled={pin.length} error={flash} shake={shake} />
        </View>
      </View>
      <View style={styles.pad}>
        <PinKeypad onKey={press} disabled={stage === 'saving'} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.xs,
  },
  dots: {
    marginTop: theme.spacing.md,
  },
  pad: {
    paddingBottom: theme.spacing.lg,
  },
}));
