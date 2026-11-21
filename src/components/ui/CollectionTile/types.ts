import type { IconName } from '../Icon';

export type CollectionTileProps = {
  name: string;
  count: number;
  icon: IconName;
  onPress?: () => void;
  testID?: string;
};
