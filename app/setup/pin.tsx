import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, IconButton, PinDots, PinPad, Screen, Text } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { choosePinHint, EASY_PIN_WARNING, isEasyPin } from '@/features/auth/onboardingCopy';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';

type Stage = 'create' | 'easy' | 'confirm' | 'saving';

const MISMATCH = 'The PINs didn’t match. Start again.';

/** J0 Choose PIN (choose, confirm, mismatch) and Add a PIN for an existing key. */
export default function CreatePinScreen() {
  const { setUp, error, vaultExists, vaultEmpty, biometry } = useSession();
  const biometrics = useBiometricAvailability();
  // After "Delete everything" the key stays but no documents do.
  const keepsDocuments = vaultExists && !vaultEmpty;
  const [stage, setStage] = useState<Stage>('create');
  const [first, setFirst] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const startOver = () => {
    setStage('create');
    setFirst('');
  };

  const {
    pin,
    error: flash,
    shake,
    press,
    clear,
  } = usePinEntry({
    onComplete: (entered, helpers) => {
      if (stage === 'create') {
        setFirst(entered);
        setMismatch(false);
        // A soft warning only: the owner may keep an easy PIN.
        setStage(isEasyPin(entered) ? 'easy' : 'confirm');
        if (!isEasyPin(entered)) helpers.clear();
        return;
      }
      if (entered !== first) {
        setMismatch(true);
        helpers.fail(startOver);
        return;
      }
      setStage('saving');
      // The biometrics step follows a new or emptied vault when there is
      // something to turn on; Add a PIN goes straight back to the documents.
      const offerBiometrics = !keepsDocuments && biometrics?.state === 'available';
      setUp(entered, { holdForOnboarding: offerBiometrics }).then((ok) => {
        if (ok && offerBiometrics) {
          router.replace('/setup/biometrics');
        } else if (!ok) {
          startOver();
          clear();
        }
      });
    },
  });

  const title =
    stage === 'confirm' || stage === 'saving'
      ? 'Enter it again'
      : keepsDocuments
        ? 'Add a PIN to your vault'
        : 'Choose a 6-digit PIN';
  const saving = keepsDocuments ? 'Saving your PIN' : 'Creating your vault key';
  const hint = mismatch
    ? MISMATCH
    : stage === 'easy'
      ? EASY_PIN_WARNING
      : stage === 'confirm'
        ? 'Same PIN, once more.'
        : stage === 'saving'
          ? saving
          : keepsDocuments
            ? 'Your documents stay where they are. The PIN is a second way in.'
            : vaultEmpty
              ? 'Your vault is empty. The PIN is your fallback when biometrics are unavailable.'
              : choosePinHint(biometry);
  const alerting = Boolean(error) || mismatch || stage === 'easy';
  const message = error ?? hint;
  useAnnouncement(stage === 'saving' ? saving : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        {keepsDocuments ? (
          <View />
        ) : (
          <IconButton icon="back" accessibilityLabel="Back" onPress={() => router.back()} />
        )}
        {keepsDocuments ? null : (
          <Text variant="footnote" tone="secondary">
            {stage === 'confirm' || stage === 'saving' ? 'Step 2 of 2' : 'Step 1 of 2'}
          </Text>
        )}
      </View>
      <View style={styles.body}>
        {keepsDocuments ? (
          <View style={styles.badge}>
            <Icon name="key" size={28} tone="inverse" />
          </View>
        ) : null}
        <Text variant="title2" align="center" accessibilityRole="header">
          {title}
        </Text>
        <View
          style={styles.message}
          accessible
          accessibilityRole={alerting ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
          accessibilityLabel={message}
        >
          {alerting ? (
            <Icon name="warning" size={16} tone={error || mismatch ? 'danger' : 'warning'} />
          ) : null}
          <Text
            variant="subheadline"
            tone={error || mismatch ? 'danger' : stage === 'easy' ? 'warning' : 'secondary'}
            align="center"
            style={styles.messageText}
          >
            {message}
          </Text>
        </View>
        <View style={styles.dots}>
          <PinDots filled={pin.length} error={flash} shake={shake} />
        </View>
        {stage === 'easy' ? (
          <View style={styles.easy}>
            <Button
              label="Use it anyway"
              variant="tinted"
              size="md"
              onPress={() => {
                clear();
                setStage('confirm');
              }}
            />
            <Button
              label="Choose another"
              variant="plain"
              size="md"
              onPress={() => {
                clear();
                startOver();
              }}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.pad}>
        <PinPad onKey={press} disabled={stage === 'easy'} busy={stage === 'saving'} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messageText: {
    flexShrink: 1,
  },
  dots: {
    marginTop: theme.spacing.md,
  },
  easy: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  pad: {
    paddingBottom: theme.spacing.lg,
  },
}));
