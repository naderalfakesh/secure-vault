import type { Palette } from '@/theme/colors';
import type { PassphraseStrength } from '@/utils/passphraseStrength';

// Uses borderStrong instead of surfaceMuted so the track stays visible on solid dark sheets.
export const TRACK: keyof Palette = 'borderStrong';

export const levelColor: Record<PassphraseStrength, keyof Palette> = {
  0: TRACK,
  1: 'danger',
  2: 'warning',
  3: 'success',
  4: 'success',
};

export const SEGMENTS = [1, 2, 3, 4] as const;
