import { ScrollView, View } from 'react-native';

import { PinDots, PinPad, Screen, Text, usePinPadMetrics, useAnnouncement } from '@/components/ui';
import { useSessionState } from '@/features/session/SessionProvider';

import { EasyPinChoice, KeyBadge, PinMessage, SetupPinHeader } from './components';
import { isConfirmStep, pinPrompt } from './helpers';
import { useSetupPinFlow } from './hooks/useSetupPinFlow';
import { styles } from './SetupPinScreen.styles';

export function SetupPinScreen() {
  const { vaultExists, vaultEmpty, biometry } = useSessionState();
  const { compact } = usePinPadMetrics();
  // "Delete everything" keeps the device key with 0 documents, so require !vaultEmpty too.
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
  useAnnouncement(stage === 'saving' ? saving : alerting ? message : null);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <SetupPinHeader keepsDocuments={keepsDocuments} confirming={isConfirmStep(stage)} />
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
