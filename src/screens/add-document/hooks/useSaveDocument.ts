import { router } from 'expo-router';
import { type Dispatch, type RefObject, useCallback, useRef } from 'react';

import { useToast } from '@/components/ui';
import { parseTags } from '@/features/documents/tags';
import { scanText } from '@/features/scan/scanCopy';
import { useSessionActions } from '@/features/session/SessionProvider';
import { documentService } from '@/services/DocumentService';
import type { Document, PickedFile } from '@/types';
import { plainErrorMessage } from '@/utils/errors';

import type { DetailsAction, DetailsState } from '../detailsReducer';
import type { FlowAction } from '../flowReducer';
import type { SaveNotice } from '../types';

class SaveStopped extends Error {}

type SaveDocumentOptions = {
  heldRef: RefObject<PickedFile[]>;
  savingRef: RefObject<boolean>;
  mountedRef: RefObject<boolean>;
  details: DetailsState;
  savedId: string | null;
  dispatchDetails: Dispatch<DetailsAction>;
  dispatch: Dispatch<FlowAction>;
};

export function useSaveDocument({
  heldRef,
  savingRef,
  mountedRef,
  details,
  savedId,
  dispatchDetails,
  dispatch,
}: SaveDocumentOptions) {
  const toast = useToast();
  const { captureSession, postNotice } = useSessionActions();
  // Cached once files are encrypted into the vault so "Try again" only retries failed metadata writes.
  const saved = useRef<Document | null>(null);

  const resetSave = useCallback(() => {
    dispatch({ type: 'saveReset' });
    saved.current = null;
  }, [dispatch]);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    const pages = heldRef.current;
    if (pages.length === 0) return;
    const { title, category, tags, fields, ocrText } = details;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      dispatchDetails({ type: 'titleMissing' });
      return;
    }

    const session = captureSession();
    const startedUnlocked = session.current();
    // Lock ends the session before navigation unmounts this screen; avoid toasts the lock immediately clears.
    const lockedMeanwhile = () => startedUnlocked && !session.current();
    const report = (notice: SaveNotice) => {
      if (!lockedMeanwhile() && (mountedRef.current || session.current())) toast.show(notice);
      else postNotice(notice);
    };
    savingRef.current = true;
    dispatch({ type: 'saveStarted' });
    try {
      await documentService.initialize();
      // Abort before writing if the vault locked during initialize().
      if (startedUnlocked && !session.current()) throw new SaveStopped();

      let document = saved.current;
      if (!document) {
        document = await documentService.addDocument(pages, {
          title: cleanTitle,
          category,
          tags: parseTags(tags),
          ocrText,
        });
        saved.current = document;
        if (mountedRef.current) dispatch({ type: 'saved', id: document.id });
      }

      if (mountedRef.current) dispatch({ type: 'saveAdvanced', step: 'index' });
      if (fields.length > 0) await documentService.setFields(document.id, fields);
      const id = document.id;
      const message = scanText(ocrText ? 'saved.withText' : 'saved.plain');
      if (mountedRef.current && !lockedMeanwhile()) {
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
      if (mountedRef.current && !lockedMeanwhile()) {
        dispatch({ type: 'saveFailed', message });
      } else {
        report({ message, tone: 'danger' });
      }
    } finally {
      savingRef.current = false;
      // Discard plaintext copies if unmount skipped cleanup while this save owned them.
      if (!mountedRef.current) {
        for (const picked of pages) documentService.discardPickedCopy(picked.uri);
      }
    }
  }, [
    heldRef,
    savingRef,
    mountedRef,
    details,
    dispatchDetails,
    dispatch,
    toast,
    captureSession,
    postNotice,
  ]);

  const openSaved = useCallback(() => {
    if (!savedId) return;
    router.back();
    router.push(`/documents/${savedId}`);
  }, [savedId]);

  return { save, resetSave, openSaved };
}
