import type { ReactNode } from 'react';

export type PaperThumbnailProps = {
  width?: number;
  height?: number;
  radius?: number;
  /** A decrypted thumbnail image; the paper placeholder shows until it is ready. */
  children?: ReactNode;
  testID?: string;
};
