import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  Button,
  Chip,
  Group,
  Icon,
  IconButton,
  InlineAlert,
  ListRow,
  Screen,
  Sheet,
  Text,
  useToast,
} from '@/components/ui';
import { useAnnouncement } from '@/components/ui/announce';
import type { ExtractedField } from '@/data/DocumentRepository';
import { allCategories, categoryIcons, categoryLabel } from '@/features/documents/categories';
import { DocumentImage } from '@/features/documents/DocumentImage';
import { useDeleteWithUndo } from '@/features/documents/useDeleteWithUndo';
import { useSession } from '@/features/session/SessionProvider';
import { PageStage } from '@/features/viewer/PageStage';
import { documentService } from '@/services/DocumentService';
import { ocrService } from '@/services/OcrService';
import { type Document, DocumentCategory } from '@/types';
import { isolate } from '@/utils/bidi';
import { isKeyLocked } from '../../modules/expo-vault/src/withKeyRecovery';
import { formatDate, formatExpiry, formatFileSize, pluralize } from '@/utils/format';
import { plainErrorMessage } from '@/utils/errors';

const fieldTitles: Record<string, string> = {
  expires: 'Expires',
  issued: 'Issued',
  number: 'Number',
};

/** Glass controls and text on the stage are white in both themes. */
const STAGE_INK = '#FFFFFF';
const STAGE_INK_DIM = '#B3BAD1';
/** The loading placeholder appears only once a page takes longer than this. */
const PLACEHOLDER_DELAY_MS = 300;
/** Lets the details sheet finish closing before the system share sheet opens. */
const SHEET_CLOSE_MS = 450;

function maskNumber(value: string): string {
  return `•••• ${value.slice(-4)}`;
}

type LoadFailure = 'missing' | 'unreadable';

export default function DocumentViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { settings, stepUp, withoutAutoLock, captureSession, postNotice } = useSession();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ kind: LoadFailure; detail?: string } | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [page, setPage] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [details, setDetails] = useState(false);
  const [revealNumber, setRevealNumber] = useState(false);
  const [busy, setBusy] = useState<'ocr' | 'delete' | 'share' | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', category: DocumentCategory.OTHER, tags: '' });
  const [titleError, setTitleError] = useState(false);
  const [slow, setSlow] = useState(false);
  const mounted = useRef(true);
  const deleteWithUndo = useDeleteWithUndo();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    documentService
      .initialize()
      .then(() => documentService.getDocument(id))
      .then(async (doc) => {
        if (!doc) {
          if (active) setFailure({ kind: 'missing' });
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
        if (!active) return;
        // A key that was not unlocked is not damage; say what happened instead.
        const code = (e as { code?: unknown } | null)?.code;
        setFailure({
          kind: 'unreadable',
          detail:
            isKeyLocked(e) || code === 'KEY_INVALIDATED'
              ? plainErrorMessage(e, 'It may be damaged.')
              : undefined,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // A slow page gets a placeholder and a spinner, not a blank stage.
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), PLACEHOLDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);
  useAnnouncement(loading && slow ? `Opening page ${page + 1}` : null);

  // A revealed number is masked again as soon as the app leaves the screen.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') setRevealNumber(false);
    });
    return () => subscription.remove();
  }, []);

  const goToLibrary = useCallback(() => {
    if (router.canGoBack?.()) router.back();
    else router.replace('/');
  }, []);

  const share = useCallback(async () => {
    if (!document) return;
    const session = captureSession();
    if (settings.biometricsForShare && !(await stepUp())) {
      toast.show({ message: 'Confirm with biometrics to share.' });
      return;
    }
    setBusy('share');
    const copy = await documentService.prepareShareFile(document.id).catch(() => null);
    // The decrypted copy must not reach a share sheet once the vault has
    // locked or this screen is gone: the sheet would open over the lock screen.
    if (!mounted.current || !(await session.confirm()) || !mounted.current) {
      copy?.discard();
      if (!session.current()) {
        // The lock sweep may have run before the copy was written; sweep again
        // unless a new session has already been unlocked.
        if (!captureSession().current()) documentService.clearCache().catch(() => {});
        postNotice({ message: 'Sharing was cancelled because the vault locked.' });
      }
      if (mounted.current) setBusy(null);
      return;
    }
    if (!copy) {
      setBusy(null);
      toast.show({ message: 'Couldn’t prepare the file.', tone: 'danger' });
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
      if (mounted.current) setBusy(null);
    }
  }, [
    document,
    settings.biometricsForShare,
    stepUp,
    toast,
    withoutAutoLock,
    captureSession,
    postNotice,
  ]);

  // From the details sheet: close it first, the share sheet cannot open over it.
  const shareFromDetails = useCallback(() => {
    setDetails(false);
    setTimeout(() => {
      if (mounted.current) void share();
    }, SHEET_CLOSE_MS);
  }, [share]);

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
        toast.show({ message: 'Text read on this device', tone: 'success' });
      } else {
        toast.show({ message: 'No readable text was found on the first page.' });
      }
    } catch (e) {
      toast.show({
        message: plainErrorMessage(e, 'Couldn’t read the text.'),
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
    setTitleError(false);
    setEditing(true);
  }, [document]);

  const saveEdits = useCallback(async () => {
    if (!document) return;
    const title = draft.title.trim();
    if (!title) {
      setTitleError(true);
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
        message: plainErrorMessage(e, 'Couldn’t update the details. Nothing was changed.'),
        tone: 'danger',
      });
    }
  }, [document, draft, toast]);

  // No confirmation: the document leaves at once and the Library offers Undo.
  const remove = useCallback(async () => {
    if (!document) return;
    setDetails(false);
    setBusy('delete');
    const removed = await deleteWithUndo([document]);
    if (removed > 0) {
      goToLibrary();
      return;
    }
    if (mounted.current) setBusy(null);
  }, [document, deleteWithUndo, goToLibrary]);

  if (failure) {
    const missing = failure.kind === 'missing';
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.failureBar}>
          <Button label="Library" variant="plain" size="md" icon="back" onPress={goToLibrary} />
        </View>
        <View style={styles.failure} accessibilityRole="alert">
          <View style={styles.failureIcon}>
            <Icon name={missing ? 'document' : 'warning'} size={30} tone="secondary" />
          </View>
          <Text variant="title3" align="center" accessibilityRole="header">
            {missing
              ? 'This document is no longer in the vault.'
              : 'This document couldn’t be opened.'}
          </Text>
          <Text variant="callout" tone="secondary" align="center">
            {missing ? 'A restore may have replaced it.' : (failure.detail ?? 'It may be damaged.')}
          </Text>
          <Button label={missing ? 'Go to Library' : 'Back to Library'} onPress={goToLibrary} />
        </View>
      </Screen>
    );
  }

  const multiPage = pages.length > 1;
  const pageLine = pages.length > 0 ? `Page ${page + 1} of ${pages.length}` : '';
  const expires = fields.find((field) => field.key === 'expires' && field.kind === 'date');

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {document && pages.length > 0 ? (
        <PageStage
          pages={pages}
          title={document.title}
          index={page}
          onIndexChange={setPage}
          onTap={() => setChrome((value) => !value)}
          onDismiss={goToLibrary}
        />
      ) : (
        <View style={styles.placeholder}>
          {loading && slow ? (
            <View style={styles.placeholderPage}>
              <ActivityIndicator color={STAGE_INK_DIM} />
            </View>
          ) : !loading ? (
            <Text variant="footnote" style={styles.dim}>
              Preview unavailable
            </Text>
          ) : null}
        </View>
      )}

      {chrome ? (
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <IconButton
            icon="back"
            variant="glass"
            accessibilityLabel="Back to Library"
            onPress={goToLibrary}
          />
          <View style={styles.titleBlock}>
            {document ? (
              <Text variant="headline" numberOfLines={1} style={styles.ink}>
                {isolate(document.title)}
              </Text>
            ) : null}
            {pageLine ? (
              <Text variant="caption" style={styles.dim}>
                {pageLine}
              </Text>
            ) : null}
          </View>
          <View style={styles.topActions}>
            <IconButton
              icon="share"
              variant="glass"
              accessibilityLabel="Share a copy"
              onPress={share}
              disabled={!document || pages.length === 0 || busy === 'share'}
            />
            <IconButton
              icon="more"
              variant="glass"
              accessibilityLabel="More actions"
              onPress={() => setDetails(true)}
              disabled={!document}
            />
          </View>
        </View>
      ) : null}

      {chrome && document ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {multiPage ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
              accessibilityRole="tablist"
              accessibilityLabel="Pages"
            >
              {pages.map((uri, index) => (
                <Pressable
                  key={uri}
                  accessibilityRole="tab"
                  accessibilityLabel={`Page ${index + 1} of ${pages.length}`}
                  accessibilityState={{ selected: index === page }}
                  onPress={() => setPage(index)}
                  style={styles.stripPage(index === page)}
                >
                  <DocumentImage source={{ uri }} style={styles.stripImage} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Details"
            onPress={() => setDetails(true)}
            style={styles.detailsPill}
          >
            <Icon name="info" size={18} color={STAGE_INK} />
            <Text variant="callout" style={[styles.ink, styles.pillLabel]}>
              Details
            </Text>
          </Pressable>
        </View>
      ) : null}

      {document ? (
        <Sheet
          visible={details}
          onClose={() => {
            setDetails(false);
            setEditing(false);
          }}
          title={editing ? 'Edit details' : undefined}
          headerAction={editing ? { label: 'Cancel', onPress: () => setEditing(false) } : undefined}
          detent={editing ? 'large' : 'auto'}
        >
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {editing ? (
              <EditDetails
                draft={draft}
                titleError={titleError}
                onChange={(next) => {
                  setDraft(next);
                  if (next.title.trim()) setTitleError(false);
                }}
                onSave={saveEdits}
              />
            ) : (
              <>
                <View style={styles.detailsHeader}>
                  <View style={styles.detailsTitle}>
                    <Text variant="title2" accessibilityRole="header">
                      {isolate(document.title)}
                    </Text>
                    <View style={styles.chips}>
                      <Chip label={categoryLabel(document.category)} />
                      {expires ? (
                        <Chip variant="status" label={formatExpiry(expires.value)} />
                      ) : null}
                    </View>
                  </View>
                  <Button label="Edit" variant="secondary" size="md" onPress={openEditor} />
                </View>

                {fields.length > 0 || document.tags.length > 0 ? (
                  <Group header="Found on this device">
                    {fields.map((field) =>
                      field.kind === 'date' ? (
                        <ListRow
                          key={field.key}
                          title={fieldTitles[field.key] ?? field.key}
                          value={formatDate(field.value)}
                        />
                      ) : (
                        <ListRow
                          key={field.key}
                          title={fieldTitles[field.key] ?? field.key}
                          value={revealNumber ? field.value : maskNumber(field.value)}
                          trailing={
                            <Button
                              label={revealNumber ? 'Hide' : 'Show'}
                              variant="plain"
                              size="md"
                              icon={revealNumber ? 'eyeOff' : 'eye'}
                              accessibilityLabel={
                                revealNumber ? 'Hide document number' : 'Show document number'
                              }
                              onPress={() => setRevealNumber((value) => !value)}
                            />
                          }
                        />
                      ),
                    )}
                    {document.tags.length > 0 ? (
                      <ListRow
                        title="Tags"
                        accessibilityLabel={`Tags: ${document.tags.join(', ')}`}
                        trailing={
                          <View style={styles.tagChips}>
                            {document.tags.map((tag) => (
                              <Chip key={tag} variant="tag" label={tag} />
                            ))}
                          </View>
                        }
                      />
                    ) : null}
                  </Group>
                ) : null}

                {document.ocrText ? null : (
                  <View style={styles.noText}>
                    <InlineAlert
                      tone="info"
                      message="No readable text was found, so this document isn’t searchable by its contents yet."
                    />
                    <Button
                      label="Read again"
                      loadingLabel="Reading the text…"
                      variant="tinted"
                      size="md"
                      loading={busy === 'ocr'}
                      disabled={pages.length === 0}
                      onPress={runOcr}
                    />
                  </View>
                )}

                <Group separatorInset="content">
                  {document.ocrText ? (
                    <ListRow
                      icon="text"
                      tint="neutral"
                      title="Text read from the pages"
                      value="Copy"
                      onPress={copyText}
                    />
                  ) : null}
                  <ListRow
                    icon="share"
                    tint="neutral"
                    title="Share a copy…"
                    onPress={shareFromDetails}
                    disabled={pages.length === 0 || busy === 'share'}
                  />
                  <ListRow
                    icon="trash"
                    title="Delete"
                    destructive
                    onPress={remove}
                    disabled={busy === 'delete'}
                  />
                </Group>

                <Text variant="footnote" tone="tertiary" style={styles.footer}>
                  {[
                    `Added ${formatDate(document.createdAt)}`,
                    pages.length > 0 ? pluralize(pages.length, 'page') : null,
                    formatFileSize(document.fileSize),
                    'Encrypted on this device',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </>
            )}
          </ScrollView>
        </Sheet>
      ) : null}
    </View>
  );
}

type Draft = { title: string; category: DocumentCategory; tags: string };

function EditDetails({
  draft,
  titleError,
  onChange,
  onSave,
}: {
  draft: Draft;
  titleError: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
}) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text variant="label" tone="tertiary">
          Title
        </Text>
        <TextInput
          value={draft.title}
          onChangeText={(title) => onChange({ ...draft, title })}
          style={[styles.input, titleError && styles.inputError]}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel="Title"
          aria-invalid={titleError}
          returnKeyType="done"
        />
        {titleError ? (
          <Text variant="footnote" tone="danger" accessibilityRole="alert">
            Give the document a title.
          </Text>
        ) : null}
      </View>
      <View style={styles.field}>
        <Text variant="label" tone="tertiary">
          Collection
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
          Tags
        </Text>
        <TextInput
          value={draft.tags}
          onChangeText={(tags) => onChange({ ...draft, tags })}
          style={styles.input}
          placeholder="Separate with commas"
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel="Tags"
          autoCapitalize="none"
        />
      </View>
      <Button label="Save" onPress={onSave} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.viewerStage,
  },
  ink: {
    color: STAGE_INK,
  },
  dim: {
    color: STAGE_INK_DIM,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderPage: {
    width: 260,
    height: 340,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  bottomBar: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  strip: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  stripPage: (selected: boolean) => ({
    width: 44,
    height: 58,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: theme.colors.paper,
    borderWidth: 2,
    borderColor: selected ? '#8EA2FF' : 'transparent',
    opacity: selected ? 1 : 0.6,
  }),
  stripImage: {
    width: '100%',
    height: '100%',
  },
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillLabel: {
    fontWeight: '600',
  },
  failureBar: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xs,
  },
  failure: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
    paddingBottom: 120,
  },
  failureIcon: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  sheetBody: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  detailsTitle: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  noText: {
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  footer: {
    paddingHorizontal: theme.spacing.xxs,
  },
  form: {
    gap: theme.spacing.md,
  },
  field: {
    gap: theme.spacing.xs,
  },
  input: {
    minHeight: theme.touchTarget,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.textPrimary,
    fontSize: 17,
    textAlign: 'auto',
    writingDirection: 'auto',
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
}));
