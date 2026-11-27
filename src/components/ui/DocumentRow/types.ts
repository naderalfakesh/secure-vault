import type { ReactNode } from 'react';

export type SnippetPart = { text: string; match?: boolean };

export type DocumentRowProps = {
  title: string;
  meta: string;
  snippet?: readonly SnippetPart[];
  thumbnail?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  selectable?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};
