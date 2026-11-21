import type { SnippetPart } from '@/components/ui';
import type { Document } from '@/types';

export type LibraryRowProps = {
  document: Document;
  onPress: (document: Document) => void;
  onLongPress?: (document: Document) => void;
  snippet?: readonly SnippetPart[];
  selectable?: boolean;
  selected?: boolean;
};
