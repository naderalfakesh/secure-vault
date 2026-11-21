import { Button, FileCard, InlineAlert, ProgressBlock } from '@/components/ui';
import { tp } from '@/i18n';
import type { RestoreProgress } from '@/services/BackupService';

import { backupCopy as copy, restoreProgressLabel } from '../../../backupCopy';
import type { PickedBackup } from '../../types';

type RunningStepProps = {
  backup: PickedBackup;
  progress: RestoreProgress;
  cancelling: boolean;
  onCancel: () => void;
};

/**
 * Checking, then Restoring. Checking leaves the vault untouched and may be
 * cancelled; once the vault is wiped there is no control.
 */
export function RunningStep({ backup, progress, cancelling, onCancel }: RunningStepProps) {
  const { wiped } = progress;
  return (
    <>
      <FileCard name={backup.name} meta={tp('format.entries', backup.entries)} />
      <ProgressBlock
        label={restoreProgressLabel(
          progress.phase === 'import' ? 'import' : 'verify',
          progress.done,
          progress.total,
        )}
        detail={copy[wiped ? 'restore.restoring.step' : 'restore.checking.step']}
        progress={progress.total ? progress.done / progress.total : 0}
      />
      {wiped ? (
        <InlineAlert
          tone="warning"
          icon="lock"
          title={copy['restore.cantStop.title']}
          message={copy['restore.cantStop.body']}
          announce
          testID="restore-cant-stop"
        />
      ) : (
        <>
          <InlineAlert tone="success" icon="shield" message={copy['restore.unchanged']} />
          <Button
            label={copy['restore.cancel']}
            variant="secondary"
            onPress={onCancel}
            loading={cancelling}
            loadingLabel={copy['restore.cancelling']}
          />
        </>
      )}
    </>
  );
}
