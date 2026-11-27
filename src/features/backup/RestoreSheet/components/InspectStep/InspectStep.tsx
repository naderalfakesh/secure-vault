import { Button, FileCard, InlineAlert, PassphraseField, Text } from '@/components/ui';

import { backupCopy as copy, backupFileMeta } from '../../../backupCopy';
import type { InspectOutcome, PickedBackup } from '../../types';

type InspectStepProps = {
  backup: PickedBackup;
  outcome: InspectOutcome | null;
  passphrase: string;
  onPassphraseChange: (value: string) => void;
  onRestore: () => void;
  onClose: () => void;
};

export function InspectStep({
  backup,
  outcome,
  passphrase,
  onPassphraseChange,
  onRestore,
  onClose,
}: InspectStepProps) {
  return (
    <>
      <FileCard name={backup.name} meta={backupFileMeta(backup.entries, backup.created)} />
      <InlineAlert tone="danger" message={copy['restore.warning']} announce={false} />
      <PassphraseField
        label={copy['restore.passphrase']}
        placeholder={copy['restore.placeholder']}
        value={passphrase}
        onChangeText={onPassphraseChange}
        error={outcome?.field ? outcome.message : null}
        selectTextOnFocus
        returnKeyType="go"
        onSubmitEditing={onRestore}
      />
      {outcome && !outcome.field ? (
        <InlineAlert tone={outcome.tone} message={outcome.message} announce />
      ) : null}
      <Text variant="footnote" tone="secondary">
        {copy['restore.explainer']}
      </Text>
      <Button
        label={copy['restore.button']}
        variant="destructive"
        onPress={onRestore}
        disabled={!passphrase}
      />
      <Button label={copy['restore.cancel']} variant="plain" onPress={onClose} />
    </>
  );
}
