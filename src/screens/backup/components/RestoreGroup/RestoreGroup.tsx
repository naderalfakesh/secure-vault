import { Group, ListRow } from '@/components/ui';
import { backupCopy as copy } from '@/features/backup/backupCopy';
import type { BackupOperation } from '@/services/BackupService';

type RestoreGroupProps = {
  earlier: BackupOperation | null;
  disabled: boolean;
  onPick: () => void;
};

export function RestoreGroup({ earlier, disabled, onPick }: RestoreGroupProps) {
  return (
    <Group header={copy['hub.restore.header']} footer={copy['hub.footnote']}>
      <ListRow
        icon="restore"
        tint="danger"
        title={copy['hub.restore.title']}
        subtitle={earlier === 'restore' ? copy['hub.restoreRunning'] : copy['hub.restore.subtitle']}
        onPress={onPick}
        disabled={disabled}
      />
    </Group>
  );
}
