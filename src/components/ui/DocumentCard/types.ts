import type { ReactNode } from 'react';

export type DocumentCardProps = {
  title: string;
  /** Brass line for the Expiring soon rail, e.g. "Expires in 82 days". */
  expiry?: string;
  /** Quiet second line when there is no expiry, e.g. the date added. */
  meta?: string;
  /** Decrypted thumbnail; the paper placeholder shows without one. */
  thumbnail?: ReactNode;
  /** `rail` is a fixed 210 pt card for horizontal rails; `grid` fills its column. */
  layout?: 'rail' | 'grid';
  onPress?: () => void;
  /** Defaults to the title plus the visible lines. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};
