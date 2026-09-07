import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  Screen,
  Sheet,
  Skeleton,
  Text,
  useToast,
} from '@/components/ui';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { useSession } from '@/features/session/SessionProvider';
import { PageViewer } from '@/features/viewer/PageViewer';
import { documentService, UNDO_TOAST_MS } from '@/services/DocumentService';
import { ocrService } from '@/services/OcrService';
import type { ExtractedField } from '@/data/DocumentRepository';
import { type Document, DocumentCategory } from '@/types';
import { formatDate, formatFileSize } from '@/utils/format';

const fieldTitles: Record<string, string> = {
  expires: 'Expires',
  issued: 'Issued',
  number: 'Number',
};

function maskNumber(value: string): string {
  return `${'•'.repeat(Math.max(0, value.length - 3))}${value.slice(-3)}`;
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { theme } = useUnistyles();
  const { settings, stepUp, withoutAutoLock } = useSession();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [revealNumber, setRevealNumber] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState<'ocr' | 'delete' | 'share' | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', category: DocumentCategory.OTHER, tags: '' });

  useEffect(() => {
    if (!id) return;
    let active = true;
    documentService
      .initialize()
      .then(() => documentService.getDocument(id))
      .then(async (doc) => {
        if (!doc) {
          if (active) setError('This document is no longer in the vault.');
          return;
        }
        const [pageUris, extracted] = await Promise.all([
          documentService.getDocumentPages(id),
          documentService.getFields(id),
        ]);
        if (active) {
          setDocument(doc);
          setPages(pageUris);
          setFields(extracted);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not open the document.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const share = useCallback(async () => {
    if (!document) return;
    if (settings.biometricsForShare && !(await stepUp())) {
      toast.show({ message: 'Confirm with biometrics to share.' });
      return;
    }
    setBusy('share');
    const copy = await documentService.prepareShareFile(document.id).catch(() => null);
    if (!copy) {
      setBusy(null);
      toast.show({ message: 'Could not prepare the file.', tone: 'danger' });
      return;
    }
    try {
      // The share sheet is system UI; the vault must not lock behind it.
      await withoutAutoLock(() =>
        Sharing.shareAsync(copy.uri, {
          dialogTitle: document.title,
          mimeType: document.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
          UTI: document.fileType === 'pdf' ? 'com.adobe.pdf' : 'public.jpeg',
        }),
      );
    } catch {
      // Sheet dismissed or sharing unavailable; the copy is discarded either way.
    } finally {
      copy.discard();
      setBusy(null);
    }
  }, [document, settings.biometricsForShare, stepUp, toast, withoutAutoLock]);

  const copyText = useCallback(async () => {
    if (!document?.ocrText) return;
    await Clipboard.setStringAsync(document.ocrText);
    toast.show({ message: 'Text copied', tone: 'success' });
  }, [document, toast]);

  const runOcr = useCallback(async () => {
    const source = pages[0];
    if (!document || !source) return;
    setBusy('ocr');
    try {
      const result = await ocrService.extractText(source);
      if (result.text && ocrService.isTextMeaningful(result.text)) {
        const ocrText = ocrService.cleanText(result.text);
        await documentService.updateDocument(document.id, { ocrText });
        setDocument({ ...document, ocrText });
        setShowText(true);
        toast.show({ message: 'Text extracted', tone: 'success' });
      } else {
        toast.show({ message: 'No readable text found on the first page.' });
      }
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : 'Could not read the text.',
        tone: 'danger',
      });
    } finally {
      setBusy(null);
    }
  }, [document, pages, toast]);

  const openEditor = useCallback(() => {
    if (!document) return;
    setDraft({
      title: document.title,
      category: document.category,
      tags: document.tags.join(', '),
    });
    setEditing(true);
  }, [document]);

  const saveEdits = useCallback(async () => {
    if (!document) return;
    const title = draft.title.trim();
    if (!title) {
      toast.show({ message: 'Give the document a title.' });
      return;
    }
    const tags = draft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      const updated = await documentService.updateDocument(document.id, {
        title,
        category: draft.category,
        tags,
      });
      if (updated) setDocument(updated);
      setEditing(false);
      toast.show({ message: 'Details updated', tone: 'success' });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : 'Could not update the document.',
        tone: 'danger',
      });
    }
  }, [document, draft, toast]);

  // Delete leaves immediately and offers undo from the list screen. The
  // encrypted copy is gone at once; the service keeps a decrypted copy in
  // the cache for the undo window and discards it after.
  const remove = useCallback(async () => {
    if (!document) return;
    setBusy('delete');
    try {
      const deleted = await documentService.deleteDocumentWithUndo(document.id);
      router.back();
      if (!deleted) return;
      toast.show({
        message: `Deleted "${deleted.document.title}"`,
        durationMs: UNDO_TOAST_MS,
        action: {
          label: 'Undo',
          onPress: () => {
            documentService
              .restoreDocument(deleted)
              .then(() => toast.show({ message: 'Document restored', tone: 'success' }))
              .catch(() =>
                toast.show({ message: 'Could not restore the document.', tone: 'danger' }),
              );
          },
        },
      });
    } catch (e) {
      setBusy(null);
      toast.show({
        message: e instanceof Error ? e.message : 'Could not delete the document.',
        tone: 'danger',
      });
    }
  }, [document, toast]);

  if (loading) {
    return (
      <Screen edges={['bottom']} padded>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.loading}>
          <Skeleton height={320} borderRadius={16} />
          <Skeleton width="60%" height={24} />
          <Skeleton width="40%" height={16} />
        </View>
      </Screen>
    );
  }

  if (error || !document) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState
          icon="warning"
          title="Not available"
          description={error ?? 'This document is no longer in the vault.'}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const created = formatDate(document.createdAt);
  const updated = formatDate(document.updatedAt);
  const multiPage = pages.length > 1;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton icon="edit" accessibilityLabel="Edit details" onPress={openEditor} />
              <IconButton
                icon="share"
                accessibilityLabel="Share"
                onPress={share}
                disabled={pages.length === 0 || busy === 'share'}
              />
              <IconButton
                icon="trash"
                accessibilityLabel="Delete"
                tone="danger"
                onPress={remove}
                disabled={busy === 'delete'}
              />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={`Preview of ${document.title}`}
          accessibilityHint="Opens the page viewer"
          onPress={() => pages.length > 0 && setViewerIndex(0)}
          style={styles.preview}
        >
          {pages[0] ? (
            <Image
              source={{ uri: pages[0] }}
              style={styles.previewImage}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Icon name="pdf" size={40} tone="tertiary" />
              <Text variant="footnote" tone="secondary">
                Preview unavailable
              </Text>
            </View>
          )}
          {multiPage ? (
            <View style={styles.pageBadge}>
              <Icon name="document" size={12} tone="inverse" />
              <Text variant="caption" tone="inverse">
                {pages.length} pages
              </Text>
            </View>
          ) : null}
        </Pressable>

        {multiPage ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pageStrip}
          >
            {pages.map((uri, index) => (
              <Pressable
                key={uri}
                accessibilityRole="button"
                accessibilityLabel={`Open page ${index + 1}`}
                onPress={() => setViewerIndex(index)}
                style={styles.pageThumb}
              >
                <Image source={{ uri }} style={styles.pageThumbImage} contentFit="cover" />
                <Text variant="caption" tone="secondary">
                  {index + 1}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.titleBlock}>
          <Text variant="title1" accessibilityRole="header">
            {document.title}
          </Text>
          <View style={styles.meta}>
            <Chip
              label={categoryLabel(document.category)}
              icon={categoryIcons[document.category]}
            />
            <Text variant="footnote" tone="tertiary">
              {formatFileSize(document.fileSize)}
            </Text>
          </View>
          {document.tags.length > 0 ? (
            <View style={styles.tags} accessibilityLabel={`Tags: ${document.tags.join(', ')}`}>
              {document.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text variant="caption" tone="secondary">
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {fields.length > 0 ? (
          <Card>
            {fields.map((field, index) => (
              <ListRow
                key={field.key}
                icon={field.kind === 'date' ? 'calendar' : 'tag'}
                iconTone={field.key === 'expires' ? 'warning' : 'accent'}
                title={fieldTitles[field.key] ?? field.key}
                subtitle={
                  field.kind === 'date'
                    ? formatDate(field.value)
                    : revealNumber
                      ? field.value
                      : maskNumber(field.value)
                }
                onPress={
                  field.kind === 'text' ? () => setRevealNumber((value) => !value) : undefined
                }
                trailing={
                  field.kind === 'text' ? (
                    <Icon name={revealNumber ? 'eyeOff' : 'eye'} size={18} tone="tertiary" />
                  ) : (
                    <View />
                  )
                }
                divider={index < fields.length - 1}
              />
            ))}
          </Card>
        ) : null}

        <Card>
          <ListRow icon="calendar" title="Added" subtitle={created} divider={updated !== created} />
          {updated !== created ? (
            <ListRow icon="clock" title="Updated" subtitle={updated} divider={false} />
          ) : null}
        </Card>

        <Card>
          {document.ocrText ? (
            <>
              <ListRow
                icon="text"
                title="Extracted text"
                subtitle={showText ? 'Read on this device' : 'Tap to show'}
                onPress={() => setShowText((value) => !value)}
                trailing={<Icon name={showText ? 'eyeOff' : 'eye'} size={18} tone="tertiary" />}
                divider={showText}
              />
              {showText ? (
                <View style={styles.textBlock}>
                  <Text variant="callout" selectable>
                    {document.ocrText}
                  </Text>
                  <View style={styles.textActions}>
                    <Button
                      label="Copy"
                      variant="secondary"
                      size="md"
                      onPress={copyText}
                      leading={<Icon name="copy" size={16} tone="accent" />}
                    />
                    <Button
                      label="Read again"
                      variant="ghost"
                      size="md"
                      onPress={runOcr}
                      loading={busy === 'ocr'}
                    />
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <ListRow
              icon="sparkles"
              title={busy === 'ocr' ? 'Reading the text' : 'Read the text'}
              subtitle="Makes this document searchable. Runs on this device."
              onPress={runOcr}
              disabled={busy === 'ocr' || pages.length === 0}
              divider={false}
            />
          )}
        </Card>
      </ScrollView>

      <PageViewer
        visible={viewerIndex !== null}
        pages={pages}
        title={document.title}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Edit details">
        <View style={styles.form}>
          <View style={styles.field}>
            <Text variant="label" tone="tertiary">
              Title
            </Text>
            <TextInput
              value={draft.title}
              onChangeText={(title) => setDraft((value) => ({ ...value, title }))}
              style={styles.input}
              placeholderTextColor={theme.colors.textTertiary}
              accessibilityLabel="Title"
              returnKeyType="done"
            />
          </View>
          <View style={styles.field}>
            <Text variant="label" tone="tertiary">
              Category
            </Text>
            <View style={styles.chips}>
              {allCategories.map((category) => (
                <Chip
                  key={category}
                  label={categoryLabel(category)}
                  icon={categoryIcons[category]}
                  selected={draft.category === category}
                  onPress={() => setDraft((value) => ({ ...value, category }))}
                />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text variant="label" tone="tertiary">
              Tags
            </Text>
            <TextInput
              value={draft.tags}
              onChangeText={(tags) => setDraft((value) => ({ ...value, tags }))}
              style={styles.input}
              placeholder="Separate with commas"
              placeholderTextColor={theme.colors.textTertiary}
              accessibilityLabel="Tags"
              autoCapitalize="none"
            />
          </View>
          <Button label="Save" onPress={saveEdits} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  preview: {
    height: 320,
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
  },
  pageBadge: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  pageStrip: {
    gap: theme.spacing.xs,
  },
  pageThumb: {
    width: 64,
    alignItems: 'center',
    gap: 2,
  },
  pageThumbImage: {
    width: 64,
    height: 84,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  titleBlock: {
    gap: theme.spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xxs,
  },
  tag: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  textBlock: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  textActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  form: {
    gap: theme.spacing.md,
  },
  field: {
    gap: theme.spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  input: {
    minHeight: theme.touchTarget,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: 17,
  },
}));
