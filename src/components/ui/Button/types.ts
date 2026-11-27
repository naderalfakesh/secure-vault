import type { PressableProps } from 'react-native';

import type { Palette } from '@/theme/colors';

import type { IconName } from '../Icon';

export type ButtonVariant =
  | 'primary'
  | 'tinted'
  | 'plain'
  | 'plainDestructive'
  | 'secondary'
  | 'destructive'
  | 'destructiveSoft';

export type ButtonSize = 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  icon?: IconName;
};

export type ButtonFill = { background: keyof Palette | 'transparent'; foreground: keyof Palette };
