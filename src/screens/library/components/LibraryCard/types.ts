import type { Document } from '@/types';

export type LibraryCardProps = {
  document: Document;
  expiry: string;
  onPress: (document: Document) => void;
};
