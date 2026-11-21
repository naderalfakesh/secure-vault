import type { Document } from '@/types';

export type LibraryCardProps = {
  document: Document;
  /** Brass line, e.g. "Expires in 82 days". */
  expiry: string;
  onPress: (document: Document) => void;
};
