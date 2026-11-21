import { DocumentRow } from '@/components/ui';
import { DocumentThumbnail } from '@/features/documents/DocumentThumbnail';
import { useThumbnail } from '@/features/documents/hooks/useThumbnail';
import { documentMeta } from '@/features/documents/library';

import { THUMBNAIL_HEIGHT } from './constants';
import type { LibraryRowProps } from './types';

/** A Library row: paper thumbnail, title, "Collection · date", optional match line. */
export function LibraryRow({
  document,
  onPress,
  onLongPress,
  snippet,
  selectable,
  selected,
}: LibraryRowProps) {
  const uri = useThumbnail(document.id);

  return (
    <DocumentRow
      title={document.title}
      meta={documentMeta(document)}
      snippet={snippet}
      thumbnail={
        uri === null ? undefined : <DocumentThumbnail uri={uri} height={THUMBNAIL_HEIGHT} />
      }
      onPress={() => onPress(document)}
      onLongPress={onLongPress ? () => onLongPress(document) : undefined}
      selectable={selectable}
      selected={selected}
      testID={`document-row-${document.id}`}
    />
  );
}
