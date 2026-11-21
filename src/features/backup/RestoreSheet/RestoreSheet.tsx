import { View } from 'react-native';

import { Sheet, useAnnouncement } from '@/components/ui';

import { backupCopy as copy } from '../backupCopy';
import { InspectStep, OutcomeView, RunningStep } from './components';
import { useRestore } from './hooks/useRestore';
import { styles } from './RestoreSheet.styles';
import type { RestoreSheetProps } from './types';

/**
 * The restore sheet: Inspect → Checking → Restoring →
 * outcome. Checking leaves the vault untouched and may be cancelled; the
 * first Restoring event is the wipe boundary, after which there is no
 * control and nothing says the vault is unchanged.
 *
 * A restore is never stopped by the lock: it keeps running with the screen
 * gone so the vault is never left half replaced, and reports its outcome after
 * the next unlock. The service refuses any other backup work until it ends.
 */
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

  // The Cancel control and the point of no return are spoken when they appear.
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
