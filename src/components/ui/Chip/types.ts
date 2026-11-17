import type { PressableProps } from 'react-native';

import type { IconName } from '../Icon';

/**
 * `filter` (default) toggles a collection or filter, `status` is the brass
 * expiry chip, `success` marks "Searchable", and `tag` is an outlined `# tag`.
 */
export type ChipVariant = 'filter' | 'status' | 'success' | 'tag';

export type ChipProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: IconName;
  variant?: ChipVariant;
  selected?: boolean;
  /** Small count rendered after the label, e.g. documents in a category. */
  count?: number;
  /** Adds a remove (×) control with a 24 pt hit area. */
  onRemove?: () => void;
};
