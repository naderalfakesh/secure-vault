import { useCallback, useEffect, useRef, useState } from 'react';

import { documentService } from '@/services/DocumentService';
import type { PickedFile } from '@/types';

export function useHeldCopies() {
  const [files, setFilesState] = useState<PickedFile[]>([]);
  const [preview, setPreviewState] = useState<string | null>(null);

  // Mirrored synchronously in a ref so same-tick unmount cleanup sees every held plaintext copy.
  const heldRef = useRef<PickedFile[]>([]);
  const shown = useRef<string | null>(null);
  // True while a save owns the plaintext copies; unmount skips deleting them so DocumentService can finish.
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

  const discardCopies = useCallback(() => {
    for (const picked of heldRef.current) documentService.discardPickedCopy(picked.uri);
    if (shown.current) documentService.discardPreview(shown.current);
    setFiles([]);
    setPreview(null);
  }, [setFiles, setPreview]);

  const holdSingle = useCallback(
    (picked: PickedFile, previewUri: string) => {
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
