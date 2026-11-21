import { ScrollView, View } from 'react-native';

import { PinDots, PinPad, Screen, Text, usePinPadMetrics } from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import { useSession } from '@/features/session/SessionProvider';

import { EasyPinChoice, KeyBadge, PinMessage, SetupPinHeader } from './components';
import { isConfirmStep, pinPrompt } from './helpers';
import { useSetupPinFlow } from './hooks/useSetupPinFlow';
import { styles } from './SetupPinScreen.styles';

/** Choose PIN (choose, confirm, mismatch) and Add a PIN for an existing key. */
export function SetupPinScreen() {
  const { vaultExists, vaultEmpty, biometry } = useSession();
  const { compact } = usePinPadMetrics();
  // After "Delete everything" the key stays but no documents do.
  const keepsDocuments = vaultExists && !vaultEmpty;
  const entry = useSetupPinFlow(keepsDocuments);
  const { stage } = entry;

  const { title, saving, message, alerting, failing } = pinPrompt({
    stage,
    mismatch: entry.mismatch,
    keepsDocuments,
    vaultEmpty,
    biometry,
    shownError: entry.shownError,
  });
  // iOS ignores live regions: speak the saving state and every error.
  useAnnouncement(stage === 'saving' ? saving : alerting ? message : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <SetupPinHeader keepsDocuments={keepsDocuments} confirming={isConfirmStep(stage)} />
      {/* On a short window or at large text the prompt scrolls above the keypad. */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        bounces={false}
        showsVerticalScrollIndicator={false}
        testID="pin-header"
      >
        {keepsDocuments ? <KeyBadge /> : null}
        <Text variant="title2" align="center" accessibilityRole="header">
          {title}
        </Text>
        <PinMessage
          message={message}
          alerting={alerting}
          failing={failing}
          warning={stage === 'easy'}
        />
        <View style={styles.dots}>
          <PinDots filled={entry.pin.length} error={entry.flash} shake={entry.shake} />
        </View>
        {stage === 'easy' ? (
          <EasyPinChoice onUseAnyway={entry.acceptEasyPin} onChooseAnother={entry.chooseAnother} />
        ) : null}
      </ScrollView>
      <View style={styles.pad(compact)}>
        <PinPad onKey={entry.onKey} disabled={stage === 'easy'} busy={stage === 'saving'} />
      </View>
    </Screen>
  );
}
