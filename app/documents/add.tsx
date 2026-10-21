import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, IconButton, Screen, Text, useToast } from '@/components/ui';
import type { ExtractedField } from '@/data/DocumentRepository';
import { suggestForText } from '@/features/intelligence';
import { DetailsForm } from '@/features/scan/DetailsForm';
import { importKind, mimeTypeFor, movePage, stripExtension } from '@/features/scan/pages';
import { type ProcessingStep, ProcessingPanel } from '@/features/scan/ProcessingPanel';
import { ReviewPages } from '@/features/scan/ReviewPages';
import { pageCount, scanText } from '@/features/scan/scanCopy';
import { type Source, SourceList, type SourceProblem } from '@/features/scan/SourceList';
import { useSession } from '@/features/session/SessionProvider';
import { documentService } from '@/services/DocumentService';
import { ocrService } from '@/services/OcrService';
import { type Document, DocumentCategory, type PickedFile } from '@/types';
import { plainErrorMessage } from '@/utils/errors';

import {
  isCameraAvailable,
  isScannerSupported,
  scanDocuments,
} from '../../modules/expo-document-scanner';

/**
 * sources → (scan) review pages → reading → details → saving → Library.
 * A failed save stays on the saving step with Try again.
 */
type Phase = 'sources' | 'review' | 'reading' | 'details' | 'saving';

/** Where the pages came from: a scan goes back to its pages, anything else to the sources. */
type Origin = 'scan' | 'single';

const SCANNED_TITLE = 'Scanned document';

/** Thrown when the vault locked before the save wrote anything. */
class SaveStopped extends Error {}

/**
 * J1 Scan and import (handover §6 J1, F12).
 *
 * Picker, photo and scanner copies are plaintext. This screen owns them from
 * the moment a source hands them over: a removed page loses its copy at once,
 * and every way out without saving (Discard, Cancel, Back to the sources, a
 * late result after the screen closed, the screen closing, the lock gate
 * taking the screen away) removes them. A save in flight owns them instead:
 * the vault module still has to read them, and the service removes them when
 * it has. The lock and launch sweeps catch anything a kill leaves.
 */
export default function AddDocumentScreen() {
  const toast = useToast();
  const { withoutAutoLock, captureSession, postNotice } = useSession();
  // Hardware answers that do not change while the screen is open.
  const [scannerSupported] = useState(isScannerSupported);
  const [cameraAvailable] = useState(isCameraAvailable);

  const [phase, setPhase] = useState<Phase>('sources');
  const [origin, setOrigin] = useState<Origin>('single');
  const [files, setFilesState] = useState<PickedFile[]>([]);
  const [preview, setPreviewState] = useState<string | null>(null);
  const [problem, setProblem] = useState<SourceProblem | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [step, setStep] = useState<ProcessingStep>('ocr');
  const [saveError, setSaveError] = useState<string | null>(null);
  // The files are in the vault and only the found values failed: no going back.
  const [savedId, setSavedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [titleMissing, setTitleMissing] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>(DocumentCategory.OTHER);
  const [categorySuggested, setCategorySuggested] = useState(false);
  const [tags, setTags] = useState('');
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [ocrText, setOcrText] = useState<string | undefined>(undefined);

  // The copies this screen holds, kept in step with the state synchronously so
  // a cleanup in the same tick sees the latest set.
  const held = useRef<PickedFile[]>([]);
  // A PDF's rendered first page; a photo's preview is its own picked copy.
  const shown = useRef<string | null>(null);
  const mounted = useRef(true);
  // A save in flight owns the copies: the vault module still has to read them.
  const saving = useRef(false);
  // Bumped whenever a read is cancelled or superseded; a late read result is dropped.
  const readRun = useRef(0);
  // One source at a time: a second tap while a pick is still settling (a large
  // PDF rendering, say) would otherwise replace copies this screen still holds.
  const picking = useRef(false);
  // Set once the files are in the vault, so Try again only repeats what failed.
  const saved = useRef<Document | null>(null);

  const setFiles = useCallback((next: PickedFile[]) => {
    held.current = next;
    setFilesState(next);
  }, []);

  const setPreview = useCallback((next: string | null) => {
    shown.current = next;
    setPreviewState(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      readRun.current += 1;
      if (shown.current) documentService.discardPreview(shown.current);
      if (saving.current) return;
      for (const picked of held.current) documentService.discardPickedCopy(picked.uri);
    };
  }, []);

  // Camera access refused earlier (or in Settings) shows the callout straight
  // away; coming back from Settings with access on hides it again.
  useEffect(() => {
    if (!cameraAvailable) return;
    let active = true;
    const check = () => {
      ImagePicker.getCameraPermissionsAsync()
        .then((permission) => {
          if (!active) return;
          if (permission.granted) setCameraDenied(false);
          else if (!permission.canAskAgain) setCameraDenied(true);
        })
        .catch(() => {});
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [cameraAvailable]);

  const clearDetails = useCallback((suggestedTitle = '') => {
    setTitle(suggestedTitle);
    setTitleMissing(false);
    setCategory(DocumentCategory.OTHER);
    setCategorySuggested(false);
    setTags('');
    setFields([]);
    setOcrText(undefined);
    setSaveError(null);
    setSavedId(null);
    saved.current = null;
  }, []);

  /** Drops every copy this screen holds and goes back to the sources. */
  const discardAll = useCallback(() => {
    readRun.current += 1;
    for (const picked of held.current) documentService.discardPickedCopy(picked.uri);
    if (shown.current) documentService.discardPreview(shown.current);
    setFiles([]);
    setPreview(null);
    clearDetails();
    setPhase('sources');
  }, [setFiles, setPreview, clearDetails]);

  /**
   * Reads the text of the first page and suggests details, so the user
   * corrects instead of types. Both steps are best effort and cancellable.
   */
  const read = useCallback(
    async (previewUri: string, suggestedTitle: string) => {
      const run = (readRun.current += 1);
      const current = () => run === readRun.current && mounted.current;
      clearDetails(suggestedTitle);
      setStep('ocr');
      setPhase('reading');
      try {
        const result = await ocrService.extractText(previewUri);
        if (!current()) return;
        const text =
          result.text && ocrService.isTextMeaningful(result.text)
            ? ocrService.cleanText(result.text)
            : undefined;
        setOcrText(text);
        if (text) {
          setStep('suggest');
          const suggestion = await suggestForText(text);
          if (!current()) return;
          if (suggestion.title) setTitle(suggestion.title);
          if (suggestion.category) {
            setCategory(suggestion.category);
            setCategorySuggested(true);
          }
          if (suggestion.tags.length) setTags(suggestion.tags.join(', '));
          setFields(suggestion.fields);
        }
      } catch {
        // The form still works without suggestions.
      }
      if (current()) setPhase('details');
    },
    [clearDetails],
  );

  /** A single photo or file: straight to reading. */
  const acceptSingle = useCallback(
    (picked: PickedFile, previewUri: string, suggestedTitle: string) => {
      // Never replace copies without removing them.
      for (const old of held.current) {
        if (old.uri !== picked.uri) documentService.discardPickedCopy(old.uri);
      }
      if (shown.current && shown.current !== previewUri) {
        documentService.discardPreview(shown.current);
      }
      setProblem(null);
      setOrigin('single');
      setFiles([picked]);
      setPreview(previewUri);
      void read(previewUri, suggestedTitle);
    },
    [read, setFiles, setPreview],
  );

  /** iOS's scanner and the camera picker need camera access; a refusal shows the callout. */
  const cameraAllowed = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (mounted.current) setCameraDenied(true);
      return false;
    }
    return true;
  }, []);

  const pickFrom = useCallback(
    async (source: Source, addingPages = false) => {
      try {
        if (source === 'scan') {
          if (!isCameraAvailable()) return;
          // VisionKit uses the app's camera access; ML Kit's scanner runs in
          // Play services and needs none.
          if (Platform.OS === 'ios' && !(await cameraAllowed())) return;
          const pages = await scanDocuments();
          if (pages.length === 0) return;
          if (!mounted.current) {
            for (const page of pages) documentService.discardPickedCopy(page.uri);
            return;
          }
          const picked = pages.map((page, index) => ({
            uri: page.uri,
            name: `scan-${Date.now()}-${index + 1}.jpg`,
            type: 'image/jpeg',
          }));
          setProblem(null);
          setOrigin('scan');
          setFiles(addingPages ? [...held.current, ...picked] : picked);
          setPhase('review');
          return;
        }

        if (source === 'files') {
          const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/*'],
            copyToCacheDirectory: true,
          });
          const asset = result.canceled ? null : result.assets[0];
          if (!asset) return;
          documentService.discardSystemImportCopy(asset.name);
          const kind = importKind(asset.name, asset.mimeType);
          if (!kind) {
            documentService.discardPickedCopy(asset.uri);
            if (mounted.current) setProblem({ kind: 'unsupported', name: asset.name });
            return;
          }
          const type = asset.mimeType || mimeTypeFor(asset.name, kind);
          // A PDF's first page is rendered so it can be previewed and read
          // like a photo; one that cannot be rendered cannot be viewed either.
          const previewUri = await documentService.previewForFile(asset.uri, type);
          if (!mounted.current) {
            if (previewUri) documentService.discardPreview(previewUri);
            documentService.discardPickedCopy(asset.uri);
            return;
          }
          if (!previewUri) {
            documentService.discardPickedCopy(asset.uri);
            setProblem({ kind: 'unsupported', name: asset.name });
            return;
          }
          acceptSingle(
            { uri: asset.uri, name: asset.name, type, size: asset.size },
            previewUri,
            stripExtension(asset.name),
          );
          return;
        }

        if (source === 'camera') {
          if (!isCameraAvailable()) return;
          if (!(await cameraAllowed())) return;
        }
        // The system photo picker needs no photo library access.
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
        const asset = result.canceled ? null : result.assets[0];
        if (!asset) return;
        if (!mounted.current) {
          documentService.discardPickedCopy(asset.uri);
          return;
        }
        const name = asset.fileName ?? `scan-${Date.now()}.jpg`;
        acceptSingle(
          { uri: asset.uri, name, type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize },
          asset.uri,
          source === 'camera' ? SCANNED_TITLE : stripExtension(name),
        );
      } catch (e) {
        if (mounted.current) {
          setProblem({ kind: 'failed', message: plainErrorMessage(e, scanText('sources.failed')) });
        }
      }
    },
    [acceptSingle, cameraAllowed, setFiles],
  );

  const pickOnce = useCallback(
    async (source: Source, addingPages = false) => {
      if (picking.current) return;
      picking.current = true;
      try {
        await withoutAutoLock(() => pickFrom(source, addingPages));
      } finally {
        picking.current = false;
      }
    },
    [withoutAutoLock, pickFrom],
  );

  const pick = useCallback((source: Source) => pickOnce(source), [pickOnce]);
  const addPages = useCallback(() => pickOnce('scan', true), [pickOnce]);

  const removePage = useCallback(
    (index: number) => {
      const page = held.current[index];
      if (!page) return;
      documentService.discardPickedCopy(page.uri);
      const rest = held.current.filter((_, at) => at !== index);
      setFiles(rest);
      // No pages left: back to the sources.
      if (rest.length === 0) discardAll();
    },
    [setFiles, discardAll],
  );

  const reorder = useCallback(
    (index: number, delta: -1 | 1) => setFiles(movePage(held.current, index, delta)),
    [setFiles],
  );

  const continueToRead = useCallback(() => {
    const first = held.current[0];
    if (!first) return;
    // A scan's preview is its own first page: nothing extra to remove later.
    setPreview(first.uri);
    void read(first.uri, SCANNED_TITLE);
  }, [read, setPreview]);

  const backFromDetails = useCallback(() => {
    if (origin === 'scan') {
      readRun.current += 1;
      setPreview(null);
      setPhase('review');
      return;
    }
    discardAll();
  }, [origin, discardAll, setPreview]);

  const save = useCallback(async () => {
    if (saving.current) return;
    const pages = held.current;
    if (pages.length === 0) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitleMissing(true);
      return;
    }

    const session = captureSession();
    const startedUnlocked = session.current();
    // The lock ends the session before the gate takes this screen away, so a
    // save that settles in between would show a toast the lock then clears.
    const lockedMeanwhile = () => startedUnlocked && !session.current();
    // Outcomes of a save that outlived this screen or its session go to a
    // toast while the session lasts, and to the next unlock otherwise.
    const report = (notice: { message: string; tone: 'success' | 'danger' }) => {
      if (!lockedMeanwhile() && (mounted.current || session.current())) toast.show(notice);
      else postNotice(notice);
    };
    saving.current = true;
    setSaveError(null);
    setStep('encrypt');
    setPhase('saving');
    try {
      await documentService.initialize();
      // Nothing is written once the vault has locked, as with deletes.
      if (startedUnlocked && !session.current()) throw new SaveStopped();

      let document = saved.current;
      if (!document) {
        document = await documentService.addDocument(pages, {
          title: cleanTitle,
          category,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          ocrText,
        });
        saved.current = document;
        if (mounted.current) setSavedId(document.id);
      }

      if (mounted.current) setStep('index');
      if (fields.length > 0) await documentService.setFields(document.id, fields);
      const id = document.id;
      const message = scanText(ocrText ? 'saved.withText' : 'saved.plain');
      if (mounted.current && !lockedMeanwhile()) {
        router.back();
        toast.show({
          message,
          tone: 'success',
          action: { label: scanText('saved.view'), onPress: () => router.push(`/documents/${id}`) },
        });
      } else {
        report({ message, tone: 'success' });
      }
    } catch (e) {
      const message =
        e instanceof SaveStopped
          ? scanText('processing.failed')
          : plainErrorMessage(e, scanText('processing.failed'));
      if (mounted.current && !lockedMeanwhile()) {
        // Inline, with Try again; the pages stay for the retry.
        setSaveError(message);
      } else {
        report({ message, tone: 'danger' });
      }
    } finally {
      saving.current = false;
      // A failed save keeps the copies for a retry only while the screen is here.
      if (!mounted.current) {
        for (const picked of pages) documentService.discardPickedCopy(picked.uri);
      }
    }
  }, [title, ocrText, fields, category, tags, toast, captureSession, postNotice]);

  const thumbnails = origin === 'scan' ? files.map((page) => page.uri) : preview ? [preview] : [];

  let header: ReactNode;
  let body: ReactNode;
  switch (phase) {
    case 'review':
      header = (
        <Header
          leading={
            <Button
              label={scanText('review.discard')}
              variant="plain"
              size="md"
              onPress={discardAll}
            />
          }
          title={pageCount(files.length)}
          trailing={
            <Button
              label={scanText('review.continue')}
              variant="plain"
              size="md"
              onPress={continueToRead}
            />
          }
        />
      );
      body = (
        <ReviewPages
          pages={files}
          onRemove={removePage}
          onMove={reorder}
          onAddPages={scannerSupported ? addPages : undefined}
        />
      );
      break;
    case 'reading':
    case 'saving':
      header = <Header />;
      body = (
        <ProcessingPanel
          step={step}
          thumbnails={thumbnails}
          onCancel={discardAll}
          error={phase === 'saving' ? saveError : null}
          onRetry={save}
          onBack={savedId ? undefined : () => setPhase('details')}
          onOpen={
            savedId
              ? () => {
                  router.back();
                  router.push(`/documents/${savedId}`);
                }
              : undefined
          }
        />
      );
      break;
    case 'details':
      header = (
        <Header
          leading={
            <Button
              label={scanText('details.back')}
              accessibilityLabel={origin === 'scan' ? 'Back to pages' : 'Back to sources'}
              variant="plain"
              size="md"
              icon="back"
              onPress={backFromDetails}
            />
          }
          title={scanText('details.title')}
        />
      );
      body = (
        <DetailsForm
          thumbnails={thumbnails}
          fallbackName={files[0]?.name ?? ''}
          title={title}
          onTitle={(next) => {
            setTitle(next);
            if (next.trim()) setTitleMissing(false);
          }}
          titleMissing={titleMissing}
          category={category}
          categorySuggested={categorySuggested}
          onCategory={setCategory}
          fields={fields}
          onRemoveField={(key) => setFields((current) => current.filter((f) => f.key !== key))}
          tags={tags}
          onTags={setTags}
          onSave={save}
        />
      );
      break;
    default:
      header = (
        <Header
          title={scanText('sources.title')}
          trailing={
            <IconButton
              icon="close"
              accessibilityLabel={scanText('close')}
              onPress={() => router.back()}
            />
          }
        />
      );
      body = (
        <SourceList
          scannerSupported={scannerSupported}
          cameraAvailable={cameraAvailable}
          cameraDenied={cameraDenied}
          problem={problem}
          onPick={pick}
          onOpenSettings={() => void Linking.openSettings().catch(() => {})}
        />
      );
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      {header}
      {body}
    </Screen>
  );
}

function Header({
  leading,
  title,
  trailing,
}: {
  leading?: ReactNode;
  title?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>{leading}</View>
      <Text variant="headline" accessibilityRole="header" style={styles.title} numberOfLines={2}>
        {title ?? ''}
      </Text>
      <View style={[styles.side, styles.end]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: theme.spacing.xs,
  },
  side: {
    minWidth: 96,
    alignItems: 'flex-start',
  },
  end: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
}));
