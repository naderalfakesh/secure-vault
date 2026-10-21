import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Chip, Icon, Text } from '@/components/ui';
import type { ExtractedField } from '@/data/DocumentRepository';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { DocumentImage } from '@/features/documents/DocumentImage';
import type { DocumentCategory } from '@/types';
import { formatDate } from '@/utils/format';

import { foundFieldLabel, scanText } from './scanCopy';

export type DetailsFormProps = {
  /** Page images (the rendered first page for a PDF); at most three are drawn. */
  thumbnails: readonly string[];
  /** Shown when there is no image to draw, e.g. the file name. */
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

/** Confirm details (handover §6 J1): the suggestions are guesses the user can drop. */
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
              .slice(0, 3)
              .map((uri) => (
                <DocumentImage key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
              ))
          ) : (
            <View style={[styles.thumb, styles.placeholder]}>
              <Icon name="pdf" size={24} tone="tertiary" />
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {fallbackName}
              </Text>
            </View>
          )}
        </View>

        <Field label={scanText('details.titleField')}>
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
        </Field>

        <Field
          label={
            categorySuggested
              ? `${scanText('details.collection')} · ${scanText('details.suggested')}`
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
        </Field>

        {fields.length > 0 ? (
          <Field label={scanText('details.found')}>
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
          </Field>
        ) : null}

        <Field label={scanText('details.tags')} hint={scanText('details.tagsHint')}>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={onTags}
            placeholder={scanText('details.tagsPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel={scanText('details.tags')}
            autoCapitalize="none"
          />
        </Field>
      </ScrollView>
      <View style={styles.actions}>
        <Button label={scanText('details.save')} onPress={onSave} icon="lock" />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  form: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  thumbs: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: theme.radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.paper,
    overflow: 'hidden',
  },
  placeholder: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
    padding: theme.spacing.xxs,
  },
  field: {
    gap: theme.spacing.xs,
  },
  input: {
    minHeight: theme.touchTarget + 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    textAlign: 'auto',
    writingDirection: 'auto',
    ...theme.typography.body,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  found: {
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
  },
  actions: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
}));
