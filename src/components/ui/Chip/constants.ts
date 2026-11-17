import type { Palette } from '@/theme/colors';

import type { ChipVariant } from './types';

export const colours: Record<
  ChipVariant,
  { fill: keyof Palette | 'transparent'; ink: keyof Palette }
> = {
  filter: { fill: 'surfaceMuted', ink: 'textPrimary' },
  status: { fill: 'accentMuted', ink: 'accent' },
  success: { fill: 'successMuted', ink: 'success' },
  tag: { fill: 'transparent', ink: 'textPrimary' },
};
