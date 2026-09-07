import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, IconButton, Screen, Text } from '@/components/ui';
import { PinDots, PinKeypad } from '@/features/auth/PinPad';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';

type Stage = 'create' | 'confirm' | 'saving';

export default function CreatePinScreen() {
  const { setUp, error } = useSession();
  const [stage, setStage] = useState<Stage>('create');
  const [first, setFirst] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const {
    pin,
    error: flash,
    shake,
    press,
    clear,
    fail,
  } = usePinEntry({
    onComplete: (entered, helpers) => {
      if (stage === 'create') {
        setFirst(entered);
        setMismatch(false);
        setStage('confirm');
        helpers.clear();
        return;
      }
      if (entered !== first) {
        setMismatch(true);
        helpers.fail(() => {
          setStage('create');
          setFirst('');
        });
        return;
      }
      setStage('saving');
      setUp(entered).then((ok) => {
        if (!ok) {
          setStage('create');
          setFirst('');
          clear();
        }
      });
    },
  });

  const title = stage === 'confirm' ? 'Enter it again' : 'Choose a 6-digit PIN';
  const hint = mismatch
    ? 'The PINs did not match. Start again.'
    : stage === 'confirm'
      ? 'Same PIN, once more.'
      : stage === 'saving'
        ? 'Creating your vault key'
        : 'Your fallback when biometrics are unavailable.';

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="back" accessibilityLabel="Back" onPress={() => router.back()} />
      </View>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="lock" size={28} tone="accent" />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text
          variant="subheadline"
          tone={mismatch || error ? 'danger' : 'secondary'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {error ?? hint}
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
  header: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.sm,
  },
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
