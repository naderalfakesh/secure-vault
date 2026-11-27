import { type Dispatch, type SetStateAction, useCallback } from 'react';

import { useToast } from '@/components/ui';
import { useDeleteWithUndo } from '@/features/documents/hooks/useDeleteWithUndo';
import { copySensitiveText } from '@/features/viewer/clipboard';
import { useMountedRef } from '@/hooks/useMountedRef';
import { t } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import { ocrService } from '@/services/OcrService';
import type { Document } from '@/types';
import { plainErrorMessage } from '@/utils/errors';

import { goToLibrary } from '../navigation';
import type { ViewerBusy } from '../types';

type Options = {
  document: Document | null;
  setDocument: (document: Document) => void;
  pages: readonly string[];
  setBusy: Dispatch<SetStateAction<ViewerBusy>>;
  /** Closes the details sheet before the document goes. */
  closeDetails: () => void;
};

/** Copy text, Read again and Delete from the details sheet. */
export function useDocumentActions({
  document,
  setDocument,
  pages,
  setBusy,
  closeDetails,
}: Options) {
  const toast = useToast();
  const mounted = useMountedRef();
  const deleteWithUndo = useDeleteWithUndo();

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
  }, [document, pages, toast, setBusy, setDocument]);

  // No confirmation: the document leaves at once and the Library offers Undo.
  const remove = useCallback(async () => {
    if (!document) return;
    closeDetails();
    setBusy('delete');
    const removed = await deleteWithUndo([document]);
    // A lock during the delete has already taken this screen away.
    if (!mounted.current) return;
    if (removed > 0) {
      goToLibrary();
      return;
    }
    setBusy(null);
  }, [document, deleteWithUndo, closeDetails, setBusy, mounted]);

  return { copyText, runOcr, remove };
}
