import { ProgressBlock, Text } from '@/components/ui';
import { t } from '@/i18n';

import { backupCopy as copy } from '../../../backupCopy';

export type ExportProgressProps = {
  done: number;
  total: number;
  percent: number;
};

/** The busy step: progress, and a sheet that cannot be dismissed. */
export function ExportProgress({ done, total, percent }: ExportProgressProps) {
  return (
    <>
      <ProgressBlock
        label={t('backup.create.progress', { done, total })}
        detail={t('backup.create.percent', { percent })}
        progress={total ? done / total : 0}
      />
      <Text variant="subheadline" tone="secondary">
        {copy['create.busy.body']}
      </Text>
    </>
  );
}
