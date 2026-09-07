import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  type IconName,
  ListRow,
  Screen,
  Sheet,
  Text,
  useToast,
} from '@/components/ui';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { documentService } from '@/services/DocumentService';
import { suggestForText } from '@/features/intelligence';
import { useSession } from '@/features/session/SessionProvider';
import { ocrService } from '@/services/OcrService';
import type { ExtractedField } from '@/data/DocumentRepository';
import { DocumentCategory, type PickedFile } from '@/types';
import { formatDate } from '@/utils/format';

import { isScannerSupported, scanDocuments } from '../../modules/expo-document-scanner';

type Source = 'scan' | 'camera' | 'library' | 'files';
type SaveStep = 'ocr' | 'suggest' | 'encrypt' | 'index';

const scannerAvailable = isScannerSupported();

const sources: { key: Source; icon: IconName; title: string; subtitle: string }[] = [
  scannerAvailable
    ? {
        key: 'scan',
        icon: 'scan',
        title: 'Scan with the camera',
        subtitle: 'Finds the edges, straightens the page, and captures several pages',
      }
    : {
        key: 'camera',
        icon: 'camera',
        title: 'Take a photo',
        subtitle: 'Best for cards, passports, and single pages',
      },
  {
    key: 'library',
    icon: 'photos',
    title: 'Choose from Photos',
    subtitle: 'A photo you already took',
  },
  { key: 'files', icon: 'files', title: 'Import a file', subtitle: 'PDF or image from Files' },
];

const stepLabel: Record<SaveStep, string> = {
  ocr: 'Reading the text',
  suggest: 'Suggesting details',
  encrypt: 'Encrypting',
  index: 'Saving to your vault',
};
const stepOrder: SaveStep[] = ['ocr', 'suggest', 'encrypt', 'index'];

function fieldLabel(key: string): string {
  return { expires: 'Expires', issued: 'Issued', number: 'Number' }[key] ?? key;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export default function AddDocumentScreen() {
  const toast = useToast();
  const { withoutAutoLock } = useSession();
  const { theme } = useUnistyles();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const file = files[0] ?? null;
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>(DocumentCategory.OTHER);
  const [tags, setTags] = useState('');
  const [step, setStep] = useState<SaveStep | null>(null);
  const [ocrText, setOcrText] = useState<string | undefined>(undefined);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [engine, setEngine] = useState<string | null>(null);

  const accept = useCallback(
    async (picked: PickedFile[], previewUri: string | null, suggestedTitle: string) => {
      setFiles(picked);
      setPreview(previewUri);
      setTitle(suggestedTitle);
      setOcrText(undefined);
      setFields([]);
      setEngine(null);
      const first = picked[0];
      if (!first || !first.type.startsWith('image') || !previewUri) return;
      // Read the text and suggest details before the form appears, so the
      // user corrects instead of types. Both steps stay best effort.
      setStep('ocr');
      try {
        const result = await ocrService.extractText(previewUri);
        const text =
          result.text && ocrService.isTextMeaningful(result.text)
            ? ocrService.cleanText(result.text)
            : undefined;
        setOcrText(text);
        if (text) {
          setStep('suggest');
          const suggestion = await suggestForText(text);
          if (suggestion.title) setTitle(suggestion.title);
          if (suggestion.category) setCategory(suggestion.category);
          if (suggestion.tags.length) setTags(suggestion.tags.join(', '));
          setFields(suggestion.fields);
          setEngine(suggestion.engine);
        }
      } catch {
        // The form still works without suggestions.
      } finally {
        setStep(null);
      }
    },
    [],
  );

  const pickFrom = useCallback(
    async (source: Source) => {
      try {
        if (source === 'scan') {
          const pages = await scanDocuments();
          if (pages.length === 0) return;
          accept(
            pages.map((page, index) => ({
              uri: page.uri,
              name: `scan-${Date.now()}-${index + 1}.jpg`,
              type: 'image/jpeg',
            })),
            pages[0]?.uri ?? null,
            'Scanned document',
          );
          return;
        }
        if (source === 'files') {
          const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/*'],
            copyToCacheDirectory: true,
          });
          const asset = result.canceled ? null : result.assets[0];
          if (!asset) return;
          const type = asset.mimeType ?? 'application/pdf';
          accept(
            [{ uri: asset.uri, name: asset.name, type, size: asset.size }],
            type.startsWith('image') ? asset.uri : null,
            stripExtension(asset.name),
          );
          return;
        }

        const permission =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          toast.show({
            message:
              source === 'camera'
                ? 'Camera access is off. Enable it in Settings to scan.'
                : 'Photos access is off. Enable it in Settings to import.',
            tone: 'danger',
          });
          return;
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
        const asset = result.canceled ? null : result.assets[0];
        if (!asset) return;
        const name = asset.fileName ?? `scan-${Date.now()}.jpg`;
        accept(
          [{ uri: asset.uri, name, type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize }],
          asset.uri,
          source === 'camera' ? 'Scanned document' : stripExtension(name),
        );
      } catch (e) {
        toast.show({
          message: e instanceof Error ? e.message : 'Could not open that source.',
          tone: 'danger',
        });
      }
    },
    [accept, toast],
  );

  const pick = useCallback(
    (source: Source) => withoutAutoLock(() => pickFrom(source)),
    [withoutAutoLock, pickFrom],
  );

  const reset = useCallback(() => {
    setFiles([]);
    setPreview(null);
    setOcrText(undefined);
    setFields([]);
    setEngine(null);
    setTitle('');
    setTags('');
    setCategory(DocumentCategory.OTHER);
  }, []);

  const save = useCallback(async () => {
    if (!file) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.show({ message: 'Give the document a title first.' });
      return;
    }

    try {
      await documentService.initialize();

      setStep('encrypt');
      const saved = await documentService.addDocument(files, {
        title: cleanTitle,
        category,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        ocrText,
      });

      setStep('index');
      if (fields.length > 0) await documentService.setFields(saved.id, fields);
      router.back();
      toast.show({
        message: ocrText ? 'Saved with searchable text' : 'Saved to your vault',
        tone: 'success',
        action: { label: 'View', onPress: () => router.push(`/documents/${saved.id}`) },
      });
    } catch (e) {
      setStep(null);
      toast.show({
        message: e instanceof Error ? e.message : 'Could not save the document.',
        tone: 'danger',
      });
    }
  }, [file, files, title, ocrText, fields, category, tags, toast]);

  const header = (
    <View style={styles.header}>
      <IconButton
        icon={file ? 'back' : 'close'}
        accessibilityLabel={file ? 'Back to sources' : 'Cancel'}
        variant="tinted"
        onPress={file ? reset : () => router.back()}
      />
      <Text variant="headline" style={styles.headerTitle}>
        {file
          ? files.length > 1
            ? `Details · ${files.length} pages`
            : 'Details'
          : 'Add a document'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!file) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        {header}
        <View style={styles.sources}>
          <Text variant="subheadline" tone="secondary">
            The file is encrypted the moment it is saved. Text is read on this device only.
          </Text>
          <Card>
            {sources.map((source, index) => (
              <ListRow
                key={source.key}
                icon={source.icon}
                title={source.title}
                subtitle={source.subtitle}
                onPress={() => pick(source.key)}
                divider={index < sources.length - 1}
              />
            ))}
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      {header}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.preview}>
            {preview ? (
              <Image
                source={{ uri: preview }}
                style={styles.previewImage}
                contentFit="contain"
                accessibilityLabel="Preview"
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Icon name="pdf" size={36} tone="tertiary" />
                <Text variant="footnote" tone="secondary" numberOfLines={1}>
                  {file.name}
                </Text>
              </View>
            )}
          </View>

          <Field label="Title">
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Passport, lease, receipt"
              placeholderTextColor={theme.colors.textTertiary}
              accessibilityLabel="Title"
              returnKeyType="done"
            />
          </Field>

          <Field label="Category">
            <View style={styles.chips}>
              {allCategories.map((item) => (
                <Chip
                  key={item}
                  label={categoryLabel(item)}
                  icon={categoryIcons[item]}
                  selected={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </View>
          </Field>

          {fields.length > 0 ? (
            <Field
              label="Found in the text"
              hint={
                engine === 'heuristic'
                  ? 'Guessed on this device from the text. Tap a value to remove it.'
                  : undefined
              }
            >
              <View style={styles.chips}>
                {fields.map((field) => (
                  <Chip
                    key={field.key}
                    label={`${fieldLabel(field.key)}: ${field.kind === 'date' ? formatDate(field.value) : field.value}`}
                    icon={field.kind === 'date' ? 'calendar' : 'tag'}
                    onPress={() =>
                      setFields((current) => current.filter((f) => f.key !== field.key))
                    }
                  />
                ))}
              </View>
            </Field>
          ) : null}

          <Field label="Tags" hint="Separate with commas">
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="travel, 2026"
              placeholderTextColor={theme.colors.textTertiary}
              accessibilityLabel="Tags"
              autoCapitalize="none"
            />
          </Field>
        </ScrollView>
        <View style={styles.actions}>
          <Button
            label="Save to vault"
            onPress={save}
            leading={<Icon name="lock" size={18} tone="inverse" />}
          />
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={step !== null}
        onClose={() => {}}
        dismissable={false}
        title={step === 'ocr' || step === 'suggest' ? 'Reading the document' : 'Saving'}
      >
        <View style={styles.progress}>
          {stepOrder.map((item) => {
            const done = step ? stepOrder.indexOf(item) < stepOrder.indexOf(step) : false;
            const active = item === step;
            return (
              <View
                key={item}
                style={styles.progressRow}
                accessibilityLabel={`${stepLabel[item]}${done ? ', done' : active ? ', in progress' : ''}`}
              >
                {active ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Icon
                    name={done ? 'check' : 'clock'}
                    size={18}
                    tone={done ? 'success' : 'tertiary'}
                  />
                )}
                <Text variant="body" tone={active || done ? 'primary' : 'tertiary'}>
                  {stepLabel[item]}
                </Text>
              </View>
            );
          })}
        </View>
      </Sheet>
    </Screen>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: theme.touchTarget,
  },
  sources: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  form: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  preview: {
    height: 220,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  previewImage: {
    flex: 1,
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  field: {
    gap: theme.spacing.xs,
  },
  input: {
    minHeight: theme.touchTarget + 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    ...theme.typography.body,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  actions: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  progress: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 28,
  },
}));
