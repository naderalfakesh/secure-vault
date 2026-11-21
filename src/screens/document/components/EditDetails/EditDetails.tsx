import { TextInput, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Button, Chip, Text, useAnnouncement } from '@/components/ui';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { t } from '@/i18n';

import { styles } from './EditDetails.styles';
import type { Draft } from '../../types';

type EditDetailsProps = {
  draft: Draft;
  titleError: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
};

/** The edit form: title, collection and tags. */
export function EditDetails({ draft, titleError, onChange, onSave }: EditDetailsProps) {
  const { theme } = useUnistyles();
  // iOS does not speak an alert role when it appears.
  useAnnouncement(titleError ? t('viewer.edit.titleMissing') : null);

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text variant="label" tone="tertiary">
          {t('viewer.edit.titleField')}
        </Text>
        <TextInput
          value={draft.title}
          onChangeText={(title) => onChange({ ...draft, title })}
          style={[styles.input, titleError && styles.inputError]}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={t('viewer.edit.titleField')}
          aria-invalid={titleError}
          returnKeyType="done"
        />
        {titleError ? (
          <Text variant="footnote" tone="danger" accessibilityRole="alert">
            {t('viewer.edit.titleMissing')}
          </Text>
        ) : null}
      </View>
      <View style={styles.field}>
        <Text variant="label" tone="tertiary">
          {t('viewer.edit.collection')}
        </Text>
        <View style={styles.chips}>
          {allCategories.map((category) => (
            <Chip
              key={category}
              label={categoryLabel(category)}
              icon={categoryIcons[category]}
              selected={draft.category === category}
              onPress={() => onChange({ ...draft, category })}
            />
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text variant="label" tone="tertiary">
          {t('viewer.edit.tags')}
        </Text>
        <TextInput
          value={draft.tags}
          onChangeText={(tags) => onChange({ ...draft, tags })}
          style={styles.input}
          placeholder={t('viewer.edit.tagsPlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={t('viewer.edit.tags')}
          autoCapitalize="none"
        />
      </View>
      <Button label={t('viewer.edit.save')} onPress={onSave} />
    </View>
  );
}
