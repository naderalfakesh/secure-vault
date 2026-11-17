import { View } from 'react-native';

import { Button, FileCard, Icon, InlineAlert, Text } from '@/components/ui';

import { backupCopy as copy, stoppedAtLabel } from '../../../backupCopy';
import type { FinalOutcome, PickedBackup } from '../../types';
import { styles } from './OutcomeView.styles';

export type OutcomeViewProps = {
  outcome: FinalOutcome;
  backup: PickedBackup;
  onRestoreAgain: () => void;
  onChooseAnother: () => void;
  onClose: () => void;
};

export function OutcomeView({
  outcome,
  backup,
  onRestoreAgain,
  onChooseAnother,
  onClose,
}: OutcomeViewProps) {
  if (outcome.kind === 'partial') {
    return (
      <>
        <View style={styles.partialIcon}>
          <Icon name="warning" size={24} tone="danger" />
        </View>
        <Text variant="title2" accessibilityRole="header">
          {copy['restore.partial.title']}
        </Text>
        <View accessible accessibilityRole="alert" accessibilityLabel={outcome.message}>
          <Text variant="callout" tone="secondary">
            {outcome.message}
          </Text>
        </View>
        <FileCard
          name={backup.name}
          meta={outcome.stoppedAt ? stoppedAtLabel(outcome.stoppedAt) : undefined}
        />
        <Button label={copy['restore.again']} icon="refresh" onPress={onRestoreAgain} />
        <Button label={copy['restore.close']} variant="plain" onPress={onClose} />
      </>
    );
  }
  return (
    <>
      <InlineAlert tone="danger" message={outcome.message} />
      {outcome.kind === 'index' ? (
        <Button label={copy['restore.again']} icon="refresh" onPress={onRestoreAgain} />
      ) : outcome.kind === 'chooseFile' ? (
        <Button
          label={copy['restore.chooseAnother']}
          variant="secondary"
          onPress={onChooseAnother}
        />
      ) : (
        <Button label={copy['restore.close']} variant="secondary" onPress={onClose} />
      )}
    </>
  );
}
