import type { ReactNode } from 'react';

/** A piece of a search snippet; `match` pieces are highlighted. */
export type SnippetPart = { text: string; match?: boolean };

export type DocumentRowProps = {
  title: string;
  /** "Collection · N pages · relative date". */
  meta: string;
  /** Optional full-text match line with highlighted pieces. */
  snippet?: readonly SnippetPart[];
  thumbnail?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Multi-select mode: a leading check circle replaces the chevron. */
  selectable?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};
