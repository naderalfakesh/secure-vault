import { Group, ListRow } from '@/components/ui';
import { t } from '@/i18n';
import type { BackupOperation } from '@/services/BackupService';

import { eraseSubtitleKey } from '../../helpers';
import type { SettingsBusy } from '../../types';

type DangerGroupProps = {
  busy: SettingsBusy;
  /** The backup work holding the service's slot, if any. */
  running: BackupOperation | null;
  disabled: boolean;
  onErase: () => void;
};

export function DangerGroup({ busy, running, disabled, onErase }: DangerGroupProps) {
  return (
    <Group header={t('settings.group.danger')}>
      <ListRow
        icon="trash"
        title={t('settings.erase')}
        // A disabled row says why (ListRow): the erase waits for the
        // backup work holding the slot, or is itself running.
        subtitle={t(eraseSubtitleKey(busy, running))}
        destructive
        onPress={onErase}
        disabled={disabled}
      />
    </Group>
  );
}
