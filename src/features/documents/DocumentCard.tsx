import { DocumentCard as CardView, DocumentRow } from '@/components/ui';
import type { SnippetPart } from '@/components/ui';
import type { Document } from '@/types';

import { categoryLabel } from './categories';
import { thumbnailContent, useThumbnail } from './DocumentThumbnail';
import { documentMeta } from './library';

type GetThumbnail = (id: string) => Promise<string | null>;

export type LibraryCardProps = {
  document: Document;
  /** Brass line, e.g. "Expires in 82 days". */
  expiry: string;
  onPress: (document: Document) => void;
  getThumbnail: GetThumbnail;
};

/** A card on the Expiring soon rail, with the decrypted thumbnail. */
export function LibraryCard({ document, expiry, onPress, getThumbnail }: LibraryCardProps) {
  const uri = useThumbnail(document.id, getThumbnail);

  return (
    <CardView
      title={document.title}
      expiry={expiry}
      layout="rail"
      accessibilityLabel={`${document.title}, ${categoryLabel(document.category)}, ${expiry}`}
      onPress={() => onPress(document)}
      thumbnail={thumbnailContent(uri, 92)}
    />
  );
}

export type LibraryRowProps = {
  document: Document;
  onPress: (document: Document) => void;
  onLongPress?: (document: Document) => void;
  getThumbnail: GetThumbnail;
  snippet?: readonly SnippetPart[];
  selectable?: boolean;
  selected?: boolean;
};

/** A Library row: paper thumbnail, title, "Collection · date", optional match line. */
export function LibraryRow({
  document,
  onPress,
  onLongPress,
  getThumbnail,
  snippet,
  selectable,
  selected,
}: LibraryRowProps) {
  const uri = useThumbnail(document.id, getThumbnail);

  return (
    <DocumentRow
      title={document.title}
      meta={documentMeta(document)}
      snippet={snippet}
      thumbnail={thumbnailContent(uri, 56)}
      onPress={() => onPress(document)}
      onLongPress={onLongPress ? () => onLongPress(document) : undefined}
      selectable={selectable}
      selected={selected}
      testID={`document-row-${document.id}`}
    />
  );
}
