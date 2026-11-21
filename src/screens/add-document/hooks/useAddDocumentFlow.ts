import { useCallback, useReducer, useRef, useState } from 'react';

import { movePage } from '@/features/scan/pages';
import { sourceFailureMessage } from '@/features/scan/sourceErrors';
import type { Source } from '@/features/scan/SourceList';
import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';
import { documentService } from '@/services/DocumentService';
import { isCameraAvailable, isScannerSupported } from '@modules/expo-document-scanner';

import { SCANNED_TITLE } from '../constants';
import { flowReducer, initialFlowState } from '../flowReducer';
import { thumbnailsFor, withoutPage } from '../helpers';
import { importFile, pickPhoto, scanPages } from '../pickers';
import type { SinglePick } from '../types';
import { useCameraAccess } from './useCameraAccess';
import { useDetails } from './useDetails';
import { useHeldCopies } from './useHeldCopies';
import { useReadPages } from './useReadPages';
import { useSaveDocument } from './useSaveDocument';

/** The scan and import flow: which phase shows, and every move between phases. */
export function useAddDocumentFlow() {
  const { withoutAutoLock } = useSessionActions();
  // Hardware answers that do not change while the screen is open.
  const [scannerSupported] = useState(isScannerSupported);
  const [cameraAvailable] = useState(isCameraAvailable);

  const [flow, dispatch] = useReducer(flowReducer, initialFlowState);
  const { phase, origin, problem, step, saveError, savedId } = flow;
  // One source at a time: a second tap while a pick is still settling (a large
  // PDF rendering, say) would otherwise replace copies this screen still holds.
  const picking = useRef(false);

  const mountedRef = useMountedRef();
  const { files, preview, heldRef, savingRef, setFiles, setPreview, discardCopies, holdSingle } =
    useHeldCopies();
  const { cameraDenied, cameraAllowed } = useCameraAccess(cameraAvailable, mountedRef);
  const { details, dispatch: dispatchDetails, ...detailHandlers } = useDetails();
  const { save, resetSave, openSaved } = useSaveDocument({
    heldRef,
    savingRef,
    mountedRef,
    details,
    savedId,
    dispatchDetails,
    dispatch,
  });

  const clearDetails = useCallback(
    (suggestedTitle = '') => {
      dispatchDetails({ type: 'reset', title: suggestedTitle });
      resetSave();
    },
    [dispatchDetails, resetSave],
  );

  const { read, cancelRead } = useReadPages({
    mountedRef,
    dispatchDetails,
    dispatch,
    clearDetails,
  });

  /** Drops every copy this screen holds and goes back to the sources. */
  const discardAll = useCallback(() => {
    cancelRead();
    discardCopies();
    clearDetails();
    dispatch({ type: 'returnedToSources' });
  }, [cancelRead, discardCopies, clearDetails]);

  /** A single photo or file: straight to reading. */
  const acceptSingle = useCallback(
    ({ file, previewUri, suggestedTitle }: SinglePick) => {
      holdSingle(file, previewUri);
      dispatch({ type: 'singlePicked' });
      void read(previewUri, suggestedTitle);
    },
    [holdSingle, read],
  );

  const pickFrom = useCallback(
    async (source: Source, addingPages = false) => {
      const isMounted = () => mountedRef.current;
      try {
        if (source === 'scan') {
          const pages = await scanPages(cameraAllowed, isMounted);
          if (!pages) return;
          setFiles(addingPages ? [...heldRef.current, ...pages] : pages);
          dispatch({ type: 'pagesScanned' });
          return;
        }
        if (source === 'files') {
          const outcome = await importFile(isMounted);
          if (!outcome) return;
          if ('problem' in outcome) {
            if (mountedRef.current) dispatch({ type: 'sourceFailed', problem: outcome.problem });
          } else {
            acceptSingle(outcome.picked);
          }
          return;
        }
        const picked = await pickPhoto(source, cameraAllowed, isMounted);
        if (picked) acceptSingle(picked);
      } catch (e) {
        if (mountedRef.current) {
          dispatch({
            type: 'sourceFailed',
            problem: { kind: 'failed', message: sourceFailureMessage(source, e) },
          });
        }
      }
    },
    [mountedRef, heldRef, cameraAllowed, setFiles, acceptSingle],
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
      const page = heldRef.current[index];
      if (!page) return;
      documentService.discardPickedCopy(page.uri);
      const rest = withoutPage(heldRef.current, index);
      setFiles(rest);
      // No pages left: back to the sources.
      if (rest.length === 0) discardAll();
    },
    [heldRef, setFiles, discardAll],
  );

  const reorder = useCallback(
    (index: number, delta: -1 | 1) => setFiles(movePage(heldRef.current, index, delta)),
    [heldRef, setFiles],
  );

  const continueToRead = useCallback(() => {
    const first = heldRef.current[0];
    if (!first) return;
    // A scan's preview is its own first page: nothing extra to remove later.
    setPreview(first.uri);
    void read(first.uri, SCANNED_TITLE);
  }, [heldRef, read, setPreview]);

  // A scan goes back to its pages (they were already chosen in review); a
  // photo or file goes back to the sources and loses its copies.
  const backFromDetails = useCallback(() => {
    if (origin === 'scan') {
      cancelRead();
      setPreview(null);
      dispatch({ type: 'returnedToReview' });
      return;
    }
    discardAll();
  }, [origin, cancelRead, discardAll, setPreview]);

  const backToDetails = useCallback(() => dispatch({ type: 'returnedToDetails' }), []);

  return {
    phase,
    origin,
    files,
    thumbnails: thumbnailsFor(origin, files, preview),
    problem,
    step,
    scannerSupported,
    cameraAvailable,
    cameraDenied,
    details,
    ...detailHandlers,
    saveError,
    savedId,
    pick,
    addPages,
    removePage,
    reorder,
    continueToRead,
    discardAll,
    backFromDetails,
    backToDetails,
    save,
    openSaved,
  };
}
