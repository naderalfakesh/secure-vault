import type { ReactNode } from 'react';

import type { IconName } from '../Icon';

export type CollectionTileProps = {
  name: string;
  count: number;
  icon: IconName;
  onPress?: () => void;
  testID?: string;
};

export type CollectionGridProps = { children: ReactNode };
