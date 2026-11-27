import type { Palette } from '@/theme/colors';

import type { IconName } from '../Icon';
import type { InlineAlertTone } from './types';

export const looks: Record<
  InlineAlertTone,
  { fill: keyof Palette; ink: keyof Palette; icon: IconName }
> = {
  danger: { fill: 'dangerMuted', ink: 'danger', icon: 'warning' },
  info: { fill: 'surfaceMuted', ink: 'textSecondary', icon: 'info' },
  success: { fill: 'successMuted', ink: 'success', icon: 'checkCircle' },
  warning: { fill: 'accentMuted', ink: 'accent', icon: 'warning' },
};
