import { View } from 'react-native';

import { Button, Chip, Group, ListRow } from '@/components/ui';
import type { ExtractedField } from '@/data/DocumentRepository';
import { t } from '@/i18n';
import { formatDate } from '@/utils/format';

import { styles } from './FoundFields.styles';
import { fieldTitle, maskNumber } from '../../helpers';

type FoundFieldsProps = {
  fields: readonly ExtractedField[];
  tags: readonly string[];
  /** Numbers are shown in full instead of masked. */
  revealNumber: boolean;
  onToggleReveal: () => void;
};

/** What the scanner recognised, and the document's tags. */
export function FoundFields({ fields, tags, revealNumber, onToggleReveal }: FoundFieldsProps) {
  if (fields.length === 0 && tags.length === 0) return null;
  return (
    <Group header={t('viewer.found')}>
      {fields.map((field) =>
        field.kind === 'date' ? (
          <ListRow key={field.key} title={fieldTitle(field.key)} value={formatDate(field.value)} />
        ) : (
          <ListRow
            key={field.key}
            title={fieldTitle(field.key)}
            value={revealNumber ? field.value : maskNumber(field.value)}
            trailing={
              <Button
                label={t(revealNumber ? 'viewer.number.hide' : 'viewer.number.show')}
                variant="plain"
                size="md"
                icon={revealNumber ? 'eyeOff' : 'eye'}
                accessibilityLabel={t(
                  revealNumber ? 'viewer.number.hideLabel' : 'viewer.number.showLabel',
                )}
                onPress={onToggleReveal}
              />
            }
          />
        ),
      )}
      {tags.length > 0 ? (
        <ListRow
          title={t('viewer.tags')}
          accessibilityLabel={t('viewer.tagsLabel', {
            tags: tags.join(t('viewer.tagsSeparator')),
          })}
          trailing={
            <View style={styles.tagChips}>
              {tags.map((tag) => (
                <Chip key={tag} variant="tag" label={tag} />
              ))}
            </View>
          }
        />
      ) : null}
    </Group>
  );
}
