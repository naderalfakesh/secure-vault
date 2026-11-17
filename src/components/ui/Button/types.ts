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
  /** Large is 52 pt high, medium 44. */
  size?: ButtonSize;
  /** Shows a spinner and blocks presses; pair it with a verb-ing `loadingLabel`. */
  loading?: boolean;
  /** Label while loading, e.g. "Encrypting…". Defaults to `label`. */
  loadingLabel?: string;
  /** Optional leading icon, coloured to match the label. */
  icon?: IconName;
};

/** A button's background and label colours. */
export type ButtonFill = { background: keyof Palette | 'transparent'; foreground: keyof Palette };
