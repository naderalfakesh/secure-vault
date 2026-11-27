import type { PressableProps } from 'react-native';

import type { IconName } from '../Icon';
import type { TextTone } from '../Text';

export type IconButtonVariant = 'tinted' | 'plain' | 'filled' | 'glass';

export type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  icon: IconName;
  accessibilityLabel: string;
  tone?: TextTone;
  size?: number;
  variant?: IconButtonVariant;
};
