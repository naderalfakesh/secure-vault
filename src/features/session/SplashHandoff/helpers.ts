import { Appearance } from 'react-native';

import { type AppearancePreference, getAppearance } from '@/theme/appearance';

import type { Scheme } from './types';

/**
 * The system scheme, read when the overlay mounts. That is before the stored
 * Appearance setting is applied, so a pinned light or dark app still gets the
 * colours the native splash used, which always follow the system.
 */
export function systemScheme(): Scheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/** True when a pinned Appearance draws the app in the other scheme. */
export function pinnedDiffers(
  scheme: Scheme,
  pinned: AppearancePreference = getAppearance(),
): boolean {
  return pinned !== 'system' && pinned !== scheme;
}
