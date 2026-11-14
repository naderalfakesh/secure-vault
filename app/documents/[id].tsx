import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  Banner,
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
import { sharePause, useSession } from '@/features/session/SessionProvider';
import { copySensitiveText } from '@/features/viewer/clipboard';
import { PageStage } from '@/features/viewer/PageStage';
import { shareText } from '@/features/viewer/shareCopy';
import { ShareSheet, type ShareSheetStep } from '@/features/viewer/ShareSheet';
import { type StringKey, t, tp } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import { ocrService } from '@/services/OcrService';
import { type Document, DocumentCategory } from '@/types';
import { isolate } from '@/utils/bidi';
import { isKeyLocked } from '../../modules/expo-vault/src/withKeyRecovery';
import { formatDate, formatExpiry, formatFileSize, joinParts } from '@/utils/format';
import { plainErrorMessage } from '@/utils/errors';

const fieldTitles: Record<string, StringKey> = {
  expires: 'viewer.field.expires',
  issued: 'viewer.field.issued',
  number: 'viewer.field.number',
};

function fieldTitle(key: string): string {
  return fieldTitles[key] ? t(fieldTitles[key]) : key;
}

/** Glass controls and text on the stage are white in both themes. */
const STAGE_INK = '#FFFFFF';
const STAGE_INK_DIM = '#B3BAD1';
/** The loading placeholder appears only once a page takes longer than this. */
const PLACEHOLDER_DELAY_MS = 300;
/** Lets a sheet finish closing before the next sheet or the system share sheet opens. */
const SHEET_CLOSE_MS = 450;
/** The preparing step shows only for a copy that takes longer than this. */
const PREPARING_DELAY_MS = 400;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function maskNumber(value: string): string {
  return t('viewer.maskedNumber', { last4: value.slice(-4) });
}

type LoadFailure = 'missing' | 'unreadable';

export default function DocumentViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const {
    settings,
    biometry,
    stepUp,
    withoutAutoLock,
    captureSession,
    shareInterrupted,
    markShareInterrupted,
    clearShareInterrupted,
  } = useSession();
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
  const [shareStep, setShareStep] = useState<ShareSheetStep | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Bumped by every share and by Cancel: a copy whose run is no longer the
  // current one was cancelled and is removed on arrival.
  const shareRun = useRef(0);
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
              ? plainErrorMessage(e, t('viewer.unreadable.body'))
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
  useAnnouncement(loading && slow ? t('viewer.opening', { number: page + 1 }) : null);

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

  // Every share starts at the warning sheet; nothing is
  // decrypted until it is confirmed.
  const openShare = useCallback(() => {
    if (!document || pages.length === 0 || busy === 'share') return;
    setShareStep('warning');
  }, [document, pages.length, busy]);

  const cancelShare = useCallback(() => {
    if (confirming) return;
    if (busy === 'share') {
      shareRun.current += 1;
      setBusy(null);
    }
    setShareStep(null);
  }, [busy, confirming]);

  const share = useCallback(async () => {
    if (!document || busy === 'share' || confirming) return;
    const session = captureSession();
    if (settings.biometricsForShare) {
      setConfirming(true);
      const confirmed = await stepUp();
      if (mounted.current) setConfirming(false);
      if (!confirmed) {
        if (mounted.current) toast.show({ message: shareText('warning.notConfirmed') });
        return;
      }
    }
    const run = ++shareRun.current;
    setBusy('share');
    const preparing = setTimeout(() => {
      if (mounted.current && run === shareRun.current) setShareStep('preparing');
    }, PREPARING_DELAY_MS);
    const copy = await documentService.prepareShareFile(document.id).catch(() => null);
    clearTimeout(preparing);
    if (run !== shareRun.current) {
      // Cancel already closed the sheet; the copy made meanwhile goes too.
      copy?.discard();
      return;
    }
    if (mounted.current) {
      setShareStep(null);
      // The share sheet cannot open over a sheet that is still closing.
      await wait(SHEET_CLOSE_MS);
    }
    // The decrypted copy must not reach a share sheet once the vault has
    // locked or this screen is gone: the sheet would open over the lock screen.
    if (!mounted.current || !(await session.confirm()) || !mounted.current) {
      copy?.discard();
      if (!session.current()) {
        // The lock sweep may have run before the copy was written; sweep again
        // unless a new session has already been unlocked.
        if (!captureSession().current()) documentService.clearCache().catch(() => {});
        markShareInterrupted(document.id);
      }
      if (mounted.current) setBusy(null);
      return;
    }
    if (!copy) {
      setBusy(null);
      toast.show({ message: shareText('failed'), tone: 'danger' });
      return;
    }
    try {
      const pause = sharePause();
      // Android's chooser pauses the app and its JavaScript timers; a native
      // timer deletes the copy once the time away could have locked the vault,
      // so a target picked later from a chooser left open reads nothing (F7).
      const limit = settings.autoLockSeconds;
      if (Platform.OS === 'android' && limit >= 0) {
        copy.expireAfter(Math.max(pause.maxAwayMs ?? 0, limit * 1000));
      }
      // The share sheet is system UI; the vault must not lock behind it.
      // The pause ends with the session even when the sheet never settles
      // (Android blocked the chooser, or iOS never reports a sheet the lock
      // dismissed), so it cannot excuse a later session's time away.
      await withoutAutoLock(
        () =>
          Promise.race([
            Sharing.shareAsync(copy.uri, {
              dialogTitle: document.title,
              mimeType: document.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
              UTI: document.fileType === 'pdf' ? 'com.adobe.pdf' : 'public.jpeg',
            }),
            session.ended(),
          ]),
        pause,
      );
      if (!session.current()) markShareInterrupted(document.id);
    } catch {
      // Sheet dismissed or sharing unavailable; the copy is discarded either way.
    } finally {
      copy.discard();
      if (mounted.current) setBusy(null);
    }
  }, [
    document,
    busy,
    confirming,
    settings.biometricsForShare,
    settings.autoLockSeconds,
    stepUp,
    toast,
    withoutAutoLock,
    captureSession,
    markShareInterrupted,
  ]);

  // From the details sheet: close it first, one sheet at a time.
  const shareFromDetails = useCallback(() => {
    setDetails(false);
    setTimeout(() => {
      if (mounted.current) openShare();
    }, SHEET_CLOSE_MS);
  }, [openShare]);

  const shareAgain = useCallback(() => {
    clearShareInterrupted();
    openShare();
  }, [clearShareInterrupted, openShare]);

  // A banner that was seen goes once its viewer closes (Back, or the lock), so
  // later unlocks do not bring this viewer back for it. Only that same mark:
  // a share cut short meanwhile sets a newer one, which is kept.
  const bannerMark =
    document && shareInterrupted?.documentId === document.id ? shareInterrupted : null;
  const seenMark = useRef<typeof shareInterrupted>(null);
  useEffect(() => {
    if (bannerMark) seenMark.current = bannerMark;
  }, [bannerMark]);
  useEffect(
    () => () => {
      if (seenMark.current) clearShareInterrupted(seenMark.current);
    },
    [clearShareInterrupted],
  );

  const copyText = useCallback(async () => {
    if (!document?.ocrText) return;
    await copySensitiveText(document.ocrText);
    toast.show({ message: t('viewer.textCopied'), tone: 'success' });
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
        toast.show({ message: t('viewer.ocr.done'), tone: 'success' });
      } else {
        toast.show({ message: t('viewer.ocr.none') });
      }
    } catch (e) {
      toast.show({
        message: plainErrorMessage(e, t('viewer.ocr.failed')),
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
      toast.show({ message: t('viewer.edit.saved'), tone: 'success' });
    } catch (e) {
      toast.show({
        message: plainErrorMessage(e, t('viewer.edit.failed')),
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
    // A lock during the delete has already taken this screen away.
    if (!mounted.current) return;
    if (removed > 0) {
      goToLibrary();
      return;
    }
    setBusy(null);
  }, [document, deleteWithUndo, goToLibrary]);

  if (failure) {
    const missing = failure.kind === 'missing';
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.failureBar}>
          <Button
            label={t('viewer.library')}
            variant="plain"
            size="md"
            icon="back"
            onPress={goToLibrary}
          />
        </View>
        <View style={styles.failure} accessibilityRole="alert">
          <View style={styles.failureIcon}>
            <Icon name={missing ? 'document' : 'warning'} size={30} tone="secondary" />
          </View>
          <Text variant="title3" align="center" accessibilityRole="header">
            {t(missing ? 'viewer.missing.title' : 'viewer.unreadable.title')}
          </Text>
          <Text variant="callout" tone="secondary" align="center">
            {missing ? t('viewer.missing.body') : (failure.detail ?? t('viewer.unreadable.body'))}
          </Text>
          <Button
            label={t(missing ? 'viewer.missing.button' : 'viewer.unreadable.button')}
            onPress={goToLibrary}
          />
        </View>
      </Screen>
    );
  }

  const multiPage = pages.length > 1;
  const pageLine =
    pages.length > 0 ? t('viewer.pageLine', { number: page + 1, count: pages.length }) : '';
  const expires = fields.find((field) => field.key === 'expires' && field.kind === 'date');

  return (
    <View style={styles.root}>
      {/* iOS takes the status bar style from the screen's view controller
        (UIViewControllerBasedStatusBarAppearance), so the native stack sets it;
        StatusBar covers Android. */}
      <Stack.Screen options={{ headerShown: false, statusBarStyle: 'light' }} />
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
              {t('viewer.previewUnavailable')}
            </Text>
          ) : null}
        </View>
      )}

      {chrome ? (
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <IconButton
            icon="back"
            variant="glass"
            accessibilityLabel={t('viewer.backToLibrary')}
            onPress={goToLibrary}
          />
          <View style={styles.titleBlock}>
            {document ? (
              <Text variant="headline" numberOfLines={2} style={styles.ink}>
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
              accessibilityLabel={t('viewer.shareCopy')}
              onPress={openShare}
              disabled={!document || pages.length === 0 || busy === 'share'}
            />
            <IconButton
              icon="more"
              variant="glass"
              accessibilityLabel={t('viewer.moreActions')}
              onPress={() => setDetails(true)}
              disabled={!document}
            />
          </View>
        </View>
      ) : null}

      {bannerMark ? (
        <View
          style={[styles.bannerSlot, { top: insets.top + (chrome ? 62 : 10) }]}
          pointerEvents="box-none"
        >
          <Banner
            icon="lock"
            lead={shareText('interrupted.lead')}
            message={shareText('interrupted.body')}
            actions={[{ label: shareText('interrupted.again'), onPress: shareAgain }]}
            onDismiss={() => clearShareInterrupted()}
          />
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
              accessibilityLabel={t('viewer.pages')}
            >
              {pages.map((uri, index) => (
                <Pressable
                  key={uri}
                  accessibilityRole="tab"
                  accessibilityLabel={t('viewer.pageLine', {
                    number: index + 1,
                    count: pages.length,
                  })}
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
            accessibilityLabel={t('viewer.details')}
            onPress={() => setDetails(true)}
            style={styles.detailsPill}
          >
            <Icon name="info" size={18} color={STAGE_INK} />
            <Text variant="callout" style={[styles.ink, styles.pillLabel]}>
              {t('viewer.details')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {document ? (
        <ShareSheet
          step={shareStep}
          fileName={document.title}
          fileMeta={joinParts([
            tp('format.pages', Math.max(pages.length, 1)),
            t(document.fileType === 'pdf' ? 'viewer.fileType.pdf' : 'viewer.fileType.image'),
            // A size of 0 is unknown (scans saved before sizes were measured): left out.
            document.fileSize > 0 && formatFileSize(document.fileSize),
          ])}
          fileIcon={document.fileType === 'pdf' ? 'pdf' : 'image'}
          confirmFirst={settings.biometricsForShare}
          biometry={biometry}
          busy={confirming || busy === 'share'}
          onShare={share}
          onCancel={cancelShare}
        />
      ) : null}

      {document ? (
        <Sheet
          visible={details}
          onClose={() => {
            setDetails(false);
            setEditing(false);
          }}
          title={editing ? t('viewer.edit.title') : undefined}
          // The details body is its own scroll view.
          scroll={false}
          headerAction={
            editing
              ? { label: t('viewer.edit.cancel'), onPress: () => setEditing(false) }
              : undefined
          }
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
                    {/* A document name can be one long token: it wraps instead. */}
                    <Text variant="title2" accessibilityRole="header" fit={false}>
                      {isolate(document.title)}
                    </Text>
                    <View style={styles.chips}>
                      <Chip label={categoryLabel(document.category)} />
                      {expires ? (
                        <Chip variant="status" label={formatExpiry(expires.value)} />
                      ) : null}
                    </View>
                  </View>
                  <Button
                    label={t('viewer.edit.button')}
                    variant="secondary"
                    size="md"
                    onPress={openEditor}
                  />
                </View>

                {fields.length > 0 || document.tags.length > 0 ? (
                  <Group header={t('viewer.found')}>
                    {fields.map((field) =>
                      field.kind === 'date' ? (
                        <ListRow
                          key={field.key}
                          title={fieldTitle(field.key)}
                          value={formatDate(field.value)}
                        />
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
                                revealNumber
                                  ? 'viewer.number.hideLabel'
                                  : 'viewer.number.showLabel',
                              )}
                              onPress={() => setRevealNumber((value) => !value)}
                            />
                          }
                        />
                      ),
                    )}
                    {document.tags.length > 0 ? (
                      <ListRow
                        title={t('viewer.tags')}
                        accessibilityLabel={t('viewer.tagsLabel', {
                          tags: document.tags.join(t('viewer.tagsSeparator')),
                        })}
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
                    <InlineAlert tone="info" message={t('viewer.noText')} />
                    <Button
                      label={t('viewer.readAgain')}
                      loadingLabel={t('viewer.reading')}
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
                      title={t('viewer.ocrText')}
                      value={t('viewer.copy')}
                      onPress={copyText}
                    />
                  ) : null}
                  <ListRow
                    icon="share"
                    tint="neutral"
                    title={t('viewer.shareFromDetails')}
                    onPress={shareFromDetails}
                    disabled={pages.length === 0 || busy === 'share'}
                  />
                  <ListRow
                    icon="trash"
                    title={t('viewer.delete')}
                    destructive
                    onPress={remove}
                    disabled={busy === 'delete'}
                  />
                </Group>

                <Text variant="footnote" tone="tertiary" style={styles.footer}>
                  {joinParts([
                    // Isolated: a month in another script would pull the page count into the date.
                    t('viewer.added', { date: isolate(formatDate(document.createdAt)) }),
                    pages.length > 0 ? tp('format.pages', pages.length) : null,
                    // A size of 0 is unknown (scans saved before sizes were measured): left out.
                    document.fileSize > 0 && formatFileSize(document.fileSize),
                    t('viewer.encrypted'),
                  ])}
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
  bannerSlot: {
    position: 'absolute',
    start: theme.spacing.md,
    end: theme.spacing.md,
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
