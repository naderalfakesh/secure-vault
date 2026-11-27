import { Group, ListRow } from '@/components/ui';
import { t } from '@/i18n';

type DetailsActionsProps = {
  hasText: boolean;
  shareDisabled: boolean;
  deleteDisabled: boolean;
  onCopyText: () => void;
  onShare: () => void;
  onDelete: () => void;
};

export function DetailsActions({
  hasText,
  shareDisabled,
  deleteDisabled,
  onCopyText,
  onShare,
  onDelete,
}: DetailsActionsProps) {
  return (
    <Group separatorInset="content">
      {hasText ? (
        <ListRow
          icon="text"
          tint="neutral"
          title={t('viewer.ocrText')}
          value={t('viewer.copy')}
          onPress={onCopyText}
        />
      ) : null}
      <ListRow
        icon="share"
        tint="neutral"
        title={t('viewer.shareFromDetails')}
        onPress={onShare}
        disabled={shareDisabled}
      />
      <ListRow
        icon="trash"
        title={t('viewer.delete')}
        destructive
        onPress={onDelete}
        disabled={deleteDisabled}
      />
    </Group>
  );
}
