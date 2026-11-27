import type { PressableProps } from 'react-native';

import type { IconName } from '../Icon';

export type ChipVariant = 'filter' | 'status' | 'success' | 'tag';

export type ChipProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: IconName;
  variant?: ChipVariant;
  selected?: boolean;
  count?: number;
  onRemove?: () => void;
};
