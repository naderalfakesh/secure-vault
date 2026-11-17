import { Group, ListRow } from '@/components/ui';
import type { ModelInfo } from '@/features/intelligence';
import { t } from '@/i18n';

import { modelName, suggestionsSubtitle } from '../../helpers';

export type SuggestionsGroupProps = {
  /** The engine in use; empty while it is being chosen. */
  engine: string;
  model: ModelInfo | null;
  downloading: boolean;
  canDownload: boolean;
  onDownload: () => void;
};

/** Which engine suggests document details, with the on-device model's download. */
export function SuggestionsGroup({
  engine,
  model,
  downloading,
  canDownload,
  onDownload,
}: SuggestionsGroupProps) {
  return (
    <Group header={t('settings.group.suggestions')}>
      <ListRow
        icon="sparkles"
        tint="neutral"
        title={t('settings.suggestions')}
        subtitle={suggestionsSubtitle(engine, model, downloading)}
        {...(canDownload && model && !downloading
          ? {
              value: t('settings.suggestions.download'),
              accessibilityHint: t('settings.suggestions.downloadHint', {
                engine: modelName(model.engine),
              }),
              onPress: onDownload,
            }
          : {})}
      />
    </Group>
  );
}
