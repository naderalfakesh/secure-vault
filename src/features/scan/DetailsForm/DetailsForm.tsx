import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Button, Chip, Icon, Text, useAnnouncement } from '@/components/ui';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { DocumentImage } from '@/features/documents/DocumentImage';
import type { ExtractedField, DocumentCategory } from '@/types';
import { isolate } from '@/utils/bidi';
import { formatDate, joinParts } from '@/utils/format';

import { MAX_THUMBNAILS } from '../constants';
import { DetailsField } from '../DetailsField';
import { foundFieldLabel, scanText } from '../scanCopy';
import { styles } from './DetailsForm.styles';

export type DetailsFormProps = {
  thumbnails: readonly string[];
  fallbackName: string;
  title: string;
  onTitle: (title: string) => void;
  titleMissing: boolean;
  category: DocumentCategory;
  categorySuggested: boolean;
  onCategory: (category: DocumentCategory) => void;
  fields: readonly ExtractedField[];
  onRemoveField: (key: string) => void;
  tags: string;
  onTags: (tags: string) => void;
  onSave: () => void;
};

export function DetailsForm({
  thumbnails,
  fallbackName,
  title,
  onTitle,
  titleMissing,
  category,
  categorySuggested,
  onCategory,
  fields,
  onRemoveField,
  tags,
  onTags,
  onSave,
}: DetailsFormProps) {
  // iOS does not speak an alert role when it appears.
  useAnnouncement(titleMissing ? scanText('details.titleMissing') : null);
  const { theme } = useUnistyles();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View
          style={styles.thumbs}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {thumbnails.length > 0 ? (
            thumbnails
              .slice(0, MAX_THUMBNAILS)
              .map((uri) => (
                <DocumentImage key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
              ))
          ) : (
            <View style={[styles.thumb, styles.placeholder]}>
              <Icon name="pdf" size={24} tone="tertiary" />
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {isolate(fallbackName)}
              </Text>
            </View>
          )}
        </View>

        <DetailsField label={scanText('details.titleField')}>
          <TextInput
            style={[styles.input, titleMissing && styles.inputError]}
            value={title}
            onChangeText={onTitle}
            placeholder={scanText('details.titlePlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel={scanText('details.titleField')}
            aria-invalid={titleMissing}
            returnKeyType="done"
          />
          {titleMissing ? (
            <Text variant="footnote" tone="danger" accessibilityRole="alert">
              {scanText('details.titleMissing')}
            </Text>
          ) : null}
        </DetailsField>

        <DetailsField
          label={
            categorySuggested
              ? joinParts([scanText('details.collection'), scanText('details.suggested')])
              : scanText('details.collection')
          }
        >
          <View style={styles.chips}>
            {allCategories.map((item) => (
              <Chip
                key={item}
                label={categoryLabel(item)}
                icon={categoryIcons[item]}
                selected={category === item}
                onPress={() => onCategory(item)}
              />
            ))}
          </View>
        </DetailsField>

        {fields.length > 0 ? (
          <DetailsField label={scanText('details.found')}>
            <View style={styles.found}>
              <Text variant="footnote" tone="secondary">
                {scanText('details.foundHint')}
              </Text>
              <View style={styles.chips}>
                {fields.map((field) => (
                  <Chip
                    key={field.key}
                    variant={field.kind === 'date' ? 'status' : 'filter'}
                    label={foundFieldLabel(field, formatDate)}
                    onRemove={() => onRemoveField(field.key)}
                  />
                ))}
              </View>
            </View>
          </DetailsField>
        ) : null}

        <DetailsField label={scanText('details.tags')} hint={scanText('details.tagsHint')}>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={onTags}
            placeholder={scanText('details.tagsPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel={scanText('details.tags')}
            autoCapitalize="none"
          />
        </DetailsField>
      </ScrollView>
      <View style={styles.actions}>
        <Button label={scanText('details.save')} onPress={onSave} icon="lock" />
      </View>
    </KeyboardAvoidingView>
  );
}
