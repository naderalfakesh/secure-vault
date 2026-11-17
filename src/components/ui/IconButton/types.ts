import type { PressableProps } from 'react-native';

import type { IconName } from '../Icon';
import type { TextTone } from '../Text';

export type IconButtonVariant = 'tinted' | 'plain' | 'filled' | 'glass';

export type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  icon: IconName;
  /** Required: icon-only controls need a spoken name. */
  accessibilityLabel: string;
  tone?: TextTone;
  /** Glyph size; the button itself is always a 44 pt circle. */
  size?: number;
  /**
   * `tinted` (default) is the surfaceMuted circle, `plain` has no fill,
   * `filled` is primary, and `glass` is the viewer's control over the dark stage.
   */
  variant?: IconButtonVariant;
};
