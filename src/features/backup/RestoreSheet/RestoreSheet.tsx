import { View } from 'react-native';

import { Sheet, useAnnouncement } from '@/components/ui';

import { backupCopy as copy } from '../backupCopy';
import { InspectStep, OutcomeView, RunningStep } from './components';
import { useRestore } from './hooks/useRestore';
import { styles } from './RestoreSheet.styles';
import type { RestoreSheetProps } from './types';

// Restores run to completion even if the vault locks so it is never left half-replaced.
export function RestoreSheet({
  backup,
  onClose,
  onChooseAnother,
  onRestored,
  onDismissed,
}: RestoreSheetProps) {
  const { passphrase, setPassphrase, stage, cancelling, restore, cancel } = useRestore({
    backup,
    onRestored,
  });

  const running = stage.name === 'running';
  const wiped = running && stage.progress.wiped;

  useAnnouncement(
    running && !wiped ? `${copy['restore.unchanged']} ${copy['restore.cancelAvailable']}` : null,
  );

  const restoreAgain = () => void restore();

  return (
    <Sheet
      visible={backup !== null}
      onClose={onClose}
      title={
        stage.name === 'outcome' && stage.outcome.kind === 'partial'
          ? undefined
          : copy['restore.title']
      }
      dismissable={!running}
      onDismissed={onDismissed}
      testID="restore-sheet"
    >
      {backup ? (
        <View style={styles.body}>
          {stage.name === 'inspect' ? (
            <InspectStep
              backup={backup}
              outcome={stage.outcome}
              passphrase={passphrase}
              onPassphraseChange={setPassphrase}
              onRestore={restoreAgain}
              onClose={onClose}
            />
          ) : null}

          {stage.name === 'running' ? (
            <RunningStep
              backup={backup}
              progress={stage.progress}
              cancelling={cancelling}
              onCancel={cancel}
            />
          ) : null}

          {stage.name === 'outcome' ? (
            <OutcomeView
              outcome={stage.outcome}
              backup={backup}
              onRestoreAgain={restoreAgain}
              onChooseAnother={onChooseAnother}
              onClose={onClose}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}
