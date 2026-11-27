import { Appearance } from 'react-native';

import { type AppearancePreference, getAppearance } from '@/theme/appearance';

import type { Scheme } from './types';

// Read before pinned Appearance is applied so the overlay matches the native splash.
export function systemScheme(): Scheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export function pinnedDiffers(
  scheme: Scheme,
  pinned: AppearancePreference = getAppearance(),
): boolean {
  return pinned !== 'system' && pinned !== scheme;
}
