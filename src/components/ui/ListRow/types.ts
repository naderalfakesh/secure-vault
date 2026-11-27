import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';

import type { IconName } from '../Icon';
import type { TextTone } from '../Text';

export type ListRowTint = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export type ListRowProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  subtitle?: string;
  icon?: IconName;
  tint?: ListRowTint;
  value?: string;
  toggle?: { value: boolean; onValueChange: (value: boolean) => void };
  checked?: boolean;
  trailing?: ReactNode;
  destructive?: boolean;
  divider?: boolean;
};

export type ListRowAccessoryProps = Pick<
  ListRowProps,
  'trailing' | 'toggle' | 'checked' | 'disabled'
> & {
  pressable: boolean;
  destructive: boolean;
  testID?: string;
};

export type ListRowContentProps = Pick<ListRowProps, 'title' | 'subtitle' | 'value' | 'icon'> & {
  tint: ListRowTint;
  titleTone: TextTone;
  children?: ReactNode;
};
