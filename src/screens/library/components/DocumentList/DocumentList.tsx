import type { ReactElement } from 'react';
import { FlatList, View } from 'react-native';

import type { SnippetPiece } from '@/data/DocumentRepository';
import { LibraryRow } from '@/features/documents/DocumentCard';
import type { Document } from '@/types';

import { styles } from './DocumentList.styles';

type DocumentListProps = {
  documents: readonly Document[];
  getThumbnail: (id: string) => Promise<string | null>;
  /** Matched words per document, while searching. */
  snippets?: ReadonlyMap<string, SnippetPiece[] | null>;
  header?: ReactElement;
  empty?: ReactElement;
  bottomSpace: number;
  selecting: boolean;
  selected: ReadonlySet<string>;
  onOpen: (document: Document) => void;
  onToggle: (document: Document) => void;
  onStartSelecting: (document: Document) => void;
};

/** Search results, a collection or "See all", as one grouped list. */
export function DocumentList({
  documents,
  getThumbnail,
  snippets,
  header,
  empty,
  bottomSpace,
  selecting,
  selected,
  onOpen,
  onToggle,
  onStartSelecting,
}: DocumentListProps) {
  const last = documents.length - 1;
  return (
    <FlatList
      data={documents}
      keyExtractor={(document) => document.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: bottomSpace }}
      renderItem={({ item, index }) => (
        <View style={[styles.row, index === 0 && styles.first, index === last && styles.last]}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <LibraryRow
            document={item}
            getThumbnail={getThumbnail}
            snippet={snippets?.get(item.id) ?? undefined}
            selectable={selecting}
            selected={selected.has(item.id)}
            onPress={selecting ? onToggle : onOpen}
            onLongPress={selecting ? undefined : onStartSelecting}
          />
        </View>
      )}
    />
  );
}
