import { View } from 'react-native';

import { Sheet } from '@/components/ui';

import { backupCopy as copy } from '../backupCopy';
import { ExportFailed, ExportProgress, PassphraseForm } from './components';
import { styles } from './CreateBackupSheet.styles';
import { exportPercent } from './helpers';
import { useCreateBackup } from './hooks/useCreateBackup';
import type { CreateBackupSheetProps } from './types';

/**
 * The create backup sheet: passphrase with an
 * on-device strength estimate that never blocks, the two rules that are
 * enforced, a busy step that cannot be dismissed, then the system share
 * sheet, or on Android the system save screen. The container is removed once
 * sharing or saving ends. A backup finished after
 * the vault locked, or after the hub went away, is deleted unshared: the
 * share sheet is system UI and would open over the lock screen.
 */
export function CreateBackupSheet(props: CreateBackupSheetProps) {
  const { onClose } = props;
  const flow = useCreateBackup(props);
  const { stage } = flow;
  const busy = stage.name === 'busy';

  return (
    <Sheet
      visible={flow.open}
      onClose={onClose}
      title={busy ? copy['create.busy.title'] : copy['create.title']}
      headerAction={
        stage.name === 'form' ? { label: copy['restore.cancel'], onPress: onClose } : undefined
      }
      dismissable={!busy}
      // One way out, as on the Backup board: Cancel on the form, Close in
      // the error state; the busy state cannot be closed at all.
      closeButton={false}
    >
      <View style={styles.body}>
        {stage.name === 'busy' ? (
          <ExportProgress done={stage.done} total={stage.total} percent={exportPercent(stage)} />
        ) : stage.name === 'error' ? (
          <ExportFailed message={stage.message} onRetry={flow.retry} onClose={onClose} />
        ) : (
          <PassphraseForm
            passphrase={flow.passphrase}
            onPassphraseChange={flow.setPassphrase}
            confirmation={flow.confirmation}
            onConfirmationChange={flow.setConfirmation}
            preferred={flow.preferred}
            onCreate={(destination) => void flow.create(destination)}
          />
        )}
      </View>
    </Sheet>
  );
}
