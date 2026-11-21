import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';

import type { IconName } from '../Icon';
import type { TextTone } from '../Text';

/** Fill of the leading 30 pt icon tile. */
export type ListRowTint = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export type ListRowProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  /** Second line; for a disabled row, say why it is disabled here. */
  subtitle?: string;
  icon?: IconName;
  tint?: ListRowTint;
  /** Trailing value text, e.g. "After 1 minute". */
  value?: string;
  /** Trailing switch; pressing the row toggles it. */
  toggle?: { value: boolean; onValueChange: (value: boolean) => void };
  /** Radio row: shows a checkmark when true. */
  checked?: boolean;
  /** Custom trailing element; replaces the chevron. */
  trailing?: ReactNode;
  /** Destructive title colour, e.g. "Delete everything". */
  destructive?: boolean;
  /** Separator below the row when it is not inside a Group. */
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
  /** The trailing accessory. */
  children?: ReactNode;
};
