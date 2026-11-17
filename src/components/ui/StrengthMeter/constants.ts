import type { Palette } from '@/theme/colors';
import type { PassphraseStrength } from '@/utils/passphraseStrength';

/**
 * The empty track. `borderStrong`, not `surfaceMuted`: on a solid dark sheet
 * (Reduce Transparency) the muted surface is all but the sheet's own colour.
 */
export const TRACK: keyof Palette = 'borderStrong';

export const levelColor: Record<PassphraseStrength, keyof Palette> = {
  0: TRACK,
  1: 'danger',
  2: 'warning',
  3: 'success',
  4: 'success',
};

/** The meter's segments, one per strength level above zero. */
export const SEGMENTS = [1, 2, 3, 4] as const;
