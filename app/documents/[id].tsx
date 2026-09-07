import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  Screen,
  Skeleton,
  Text,
  useToast,
} from '@/components/ui';
import { categoryIcons, categoryLabel } from '@/features/documents/categories';
import { documentService } from '@/services/DocumentService';
import { ocrService } from '@/services/OcrService';
import type { Document } from '@/types';
import { formatDate, formatFileSize } from '@/utils/format';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState<'ocr' | 'delete' | null>(null);

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
        const uri = await documentService.getDocumentFile(id);
        if (active) {
          setDocument(doc);
          setFileUri(uri);
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
    if (!document || !fileUri) return;
    try {
      await Share.share({ title: document.title, url: `file://${fileUri}` });
    } catch {
      // Share sheet dismissed.
    }
  }, [document, fileUri]);

  const copyText = useCallback(async () => {
    if (!document?.ocrText) return;
    await Clipboard.setStringAsync(document.ocrText);
    toast.show({ message: 'Text copied', tone: 'success' });
  }, [document, toast]);

  const runOcr = useCallback(async () => {
    if (!document || !fileUri || document.fileType !== 'image') return;
    setBusy('ocr');
    try {
      const result = await ocrService.extractText(fileUri);
      if (result.text && ocrService.isTextMeaningful(result.text)) {
        const ocrText = ocrService.cleanText(result.text);
        await documentService.updateDocument(document.id, { ocrText });
        setDocument({ ...document, ocrText });
        setShowText(true);
        toast.show({ message: 'Text extracted', tone: 'success' });
      } else {
        toast.show({ message: 'No readable text found in this image.' });
      }
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : 'Could not read the text.',
        tone: 'danger',
      });
    } finally {
      setBusy(null);
    }
  }, [document, fileUri, toast]);

  const remove = useCallback(() => {
    if (!document) return;
    // Destructive and irreversible until Phase 7 adds undo, so a native confirmation stays.
    Alert.alert(
      'Delete this document?',
      `"${document.title}" is removed from the vault permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await documentService.deleteDocument(document.id);
              router.back();
              toast.show({ message: 'Document deleted' });
            } catch (e) {
              setBusy(null);
              toast.show({
                message: e instanceof Error ? e.message : 'Could not delete the document.',
                tone: 'danger',
              });
            }
          },
        },
      ],
    );
  }, [document, toast]);

  if (loading) {
    return (
      <Screen edges={['bottom']} padded>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.loading}>
          <Skeleton height={280} borderRadius={16} />
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

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon="share"
                accessibilityLabel="Share"
                onPress={share}
                disabled={!fileUri}
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
          accessibilityHint="Opens full screen"
          onPress={() => fileUri && setFullscreen(true)}
          style={styles.preview}
        >
          {fileUri && document.fileType === 'image' ? (
            <Image
              source={{ uri: `file://${fileUri}` }}
              style={styles.previewImage}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Icon name="pdf" size={40} tone="tertiary" />
              <Text variant="footnote" tone="secondary">
                PDF preview arrives with the viewer rework
              </Text>
            </View>
          )}
        </Pressable>

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
                    {document.fileType === 'image' ? (
                      <Button
                        label="Read again"
                        variant="ghost"
                        size="md"
                        onPress={runOcr}
                        loading={busy === 'ocr'}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          ) : document.fileType === 'image' ? (
            <ListRow
              icon="sparkles"
              title={busy === 'ocr' ? 'Reading the text' : 'Read the text'}
              subtitle="Makes this document searchable. Runs on this device."
              onPress={runOcr}
              disabled={busy === 'ocr'}
              divider={false}
            />
          ) : (
            <ListRow
              icon="text"
              title="No text extracted"
              subtitle="PDF text extraction is coming"
              divider={false}
            />
          )}
        </Card>
      </ScrollView>

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={styles.fullscreen}>
          {fileUri ? (
            <Image
              source={{ uri: `file://${fileUri}` }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
          ) : null}
          <View style={styles.fullscreenClose}>
            <IconButton
              icon="close"
              accessibilityLabel="Close"
              variant="tinted"
              onPress={() => setFullscreen(false)}
            />
          </View>
        </View>
      </Modal>
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
    height: 300,
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
  fullscreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenImage: {
    flex: 1,
  },
  fullscreenClose: {
    position: 'absolute',
    top: 56,
    right: theme.spacing.md,
  },
}));
