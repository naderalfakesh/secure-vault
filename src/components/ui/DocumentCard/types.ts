import type { ReactNode } from 'react';

export type DocumentCardProps = {
  title: string;
  expiry?: string;
  meta?: string;
  thumbnail?: ReactNode;
  layout?: 'rail' | 'grid';
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};
