import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui';
import { categoryLabel } from '@/features/documents/categories';
import { useDeleteWithUndo } from '@/features/documents/useDeleteWithUndo';
import { t, tp } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import type { Document, DocumentCategory } from '@/types';

/** Moves `ids` one by one and counts the ones that failed. */
async function moveAll(ids: readonly string[], category: DocumentCategory): Promise<number> {
  let failed = 0;
  for (const id of ids) {
    try {
      if (!(await documentService.updateDocument(id, { category }))) failed += 1;
    } catch {
      failed += 1;
    }
  }
  return failed;
}

type Options = {
  documents: readonly Document[];
  selected: ReadonlySet<string>;
  /** Called once the selection has been dealt with. */
  onDone: () => void;
  /** Called once a move has finished, whatever the outcome. */
  onMoved: () => void;
};

/** Move to… and Delete for the selected documents. */
export function useBulkActions({ documents, selected, onDone, onMoved }: Options) {
  const toast = useToast();
  const deleteWithUndo = useDeleteWithUndo();
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const moveSelected = useCallback(
    async (category: DocumentCategory) => {
      const ids = [...selected];
      setMoving(true);
      const failed = await moveAll(ids, category);
      setMoving(false);
      onMoved();
      const values = {
        documents: tp('format.documents', ids.length),
        collection: categoryLabel(category),
      };
      if (failed > 0) {
        toast.show({ message: t('library.move.failed', { failed, ...values }), tone: 'danger' });
        return;
      }
      onDone();
      toast.show({ message: t('library.move.done', values), tone: 'success' });
    },
    [selected, toast, onDone, onMoved],
  );

  const deleteSelected = useCallback(async () => {
    const chosen = documents.filter((document) => selected.has(document.id));
    if (chosen.length === 0) return;
    setDeleting(true);
    await deleteWithUndo(chosen);
    setDeleting(false);
    onDone();
  }, [documents, selected, deleteWithUndo, onDone]);

  return { moving, deleting, moveSelected, deleteSelected };
}
