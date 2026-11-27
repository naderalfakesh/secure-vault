import { Group, ListRow } from '@/components/ui';
import { t } from '@/i18n';
import type { BackupOperation } from '@/services/BackupService';

import { eraseSubtitleKey } from '../../helpers';
import type { SettingsBusy } from '../../types';

type DangerGroupProps = {
  busy: SettingsBusy;
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
        subtitle={t(eraseSubtitleKey(busy, running))}
        destructive
        onPress={onErase}
        disabled={disabled}
      />
    </Group>
  );
}
