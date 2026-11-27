import { Group, ListRow } from '@/components/ui';
import type { ModelInfo } from '@/features/intelligence';
import { t } from '@/i18n';

import { modelName, suggestionsSubtitle } from '../../helpers';

type SuggestionsGroupProps = {
  engine: string;
  model: ModelInfo | null;
  downloading: boolean;
  canDownload: boolean;
  onDownload: () => void;
};

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
