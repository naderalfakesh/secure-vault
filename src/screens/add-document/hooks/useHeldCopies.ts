import { useCallback, useEffect, useRef, useState } from 'react';

import { documentService } from '@/services/DocumentService';
import type { PickedFile } from '@/types';

/**
 * The plaintext copies the screen holds and the preview it shows. Leaving
 * the screen removes them, unless a save in flight owns them: the vault
 * module still has to read them, and the service removes them when it has.
 */
export function useHeldCopies() {
  const [files, setFilesState] = useState<PickedFile[]>([]);
  const [preview, setPreviewState] = useState<string | null>(null);

  // The copies this screen holds, kept in step with the state synchronously so
  // a cleanup in the same tick sees the latest set.
  const heldRef = useRef<PickedFile[]>([]);
  // A PDF's rendered first page; a photo's preview is its own picked copy.
  const shown = useRef<string | null>(null);
  // A save in flight owns the copies: the vault module still has to read them.
  const savingRef = useRef(false);

  const setFiles = useCallback((next: PickedFile[]) => {
    heldRef.current = next;
    setFilesState(next);
  }, []);

  const setPreview = useCallback((next: string | null) => {
    shown.current = next;
    setPreviewState(next);
  }, []);

  useEffect(
    () => () => {
      if (shown.current) documentService.discardPreview(shown.current);
      if (savingRef.current) return;
      for (const picked of heldRef.current) documentService.discardPickedCopy(picked.uri);
    },
    [],
  );

  /** Removes every copy and the preview. */
  const discardCopies = useCallback(() => {
    for (const picked of heldRef.current) documentService.discardPickedCopy(picked.uri);
    if (shown.current) documentService.discardPreview(shown.current);
    setFiles([]);
    setPreview(null);
  }, [setFiles, setPreview]);

  /** Holds one photo or file and its preview in place of anything held before. */
  const holdSingle = useCallback(
    (picked: PickedFile, previewUri: string) => {
      // Never replace copies without removing them.
      for (const old of heldRef.current) {
        if (old.uri !== picked.uri) documentService.discardPickedCopy(old.uri);
      }
      if (shown.current && shown.current !== previewUri) {
        documentService.discardPreview(shown.current);
      }
      setFiles([picked]);
      setPreview(previewUri);
    },
    [setFiles, setPreview],
  );

  return { files, preview, heldRef, savingRef, setFiles, setPreview, discardCopies, holdSingle };
}
