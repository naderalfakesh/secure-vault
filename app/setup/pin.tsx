import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  Icon,
  IconButton,
  PinDots,
  PinPad,
  Screen,
  Text,
  usePinPadMetrics,
} from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { useBiometricAvailability } from '@/features/auth/biometricAvailability';
import { choosePinHint, EASY_PIN_WARNING, isEasyPin } from '@/features/auth/onboardingCopy';
import { usePinEntry } from '@/features/auth/usePinEntry';
import { useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';

type Stage = 'create' | 'easy' | 'confirm' | 'saving';

/** J0 Choose PIN (choose, confirm, mismatch) and Add a PIN for an existing key. */
export default function CreatePinScreen() {
  const { setUp, error, vaultExists, vaultEmpty, biometry } = useSession();
  const biometrics = useBiometricAvailability();
  const { compact } = usePinPadMetrics();
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
      ? t('onboarding.pin.confirmTitle')
      : keepsDocuments
        ? t('onboarding.pin.addTitle')
        : t('onboarding.pin.chooseTitle');
  const saving = keepsDocuments ? t('onboarding.pin.savingPin') : t('onboarding.pin.creatingKey');
  const hint = mismatch
    ? t('onboarding.pin.mismatch')
    : stage === 'easy'
      ? EASY_PIN_WARNING
      : stage === 'confirm'
        ? t('onboarding.pin.confirmHint')
        : stage === 'saving'
          ? saving
          : keepsDocuments
            ? t('onboarding.pin.addHint')
            : vaultEmpty
              ? t('onboarding.pin.emptyVaultHint')
              : choosePinHint(biometry);
  const alerting = Boolean(error) || mismatch || stage === 'easy';
  const message = error ?? hint;
  const failing = Boolean(error) || mismatch;
  // iOS ignores live regions: speak the saving state and every error.
  useAnnouncement(stage === 'saving' ? saving : alerting ? message : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        {keepsDocuments ? (
          <View />
        ) : (
          <IconButton
            icon="back"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
          />
        )}
        {keepsDocuments ? null : (
          <Text variant="footnote" tone="secondary">
            {stage === 'confirm' || stage === 'saving'
              ? t('onboarding.pin.step2')
              : t('onboarding.pin.step1')}
          </Text>
        )}
      </View>
      {/* On a short window or at large text the prompt scrolls above the keypad. */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        bounces={false}
        showsVerticalScrollIndicator={false}
        testID="pin-header"
      >
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
          accessibilityLiveRegion={failing ? 'assertive' : 'polite'}
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
              label={t('onboarding.pin.useAnyway')}
              variant="tinted"
              size="md"
              onPress={() => {
                clear();
                setStage('confirm');
              }}
            />
            <Button
              label={t('onboarding.pin.chooseAnother')}
              variant="plain"
              size="md"
              onPress={() => {
                clear();
                startOver();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.pad(compact)}>
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
  bodyScroll: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
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
  pad: (compact: boolean) => ({
    paddingTop: theme.spacing.xs,
    paddingBottom: compact ? theme.spacing.sm : theme.spacing.lg,
  }),
}));
