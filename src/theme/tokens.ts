import { Platform } from 'react-native';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
} as const;

export const inset = { hair: 2, tight: 6, snug: 10, roomy: 14 } as const;

export const layout = {
  titleMargin: 20,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  card: 20,
  group: 20,
  input: 14,
  sheet: 36,
  sheetAttached: 28,
  toast: 18,
  pill: 999,
} as const;

export const sheetInset = Platform.OS === 'ios' ? 8 : 0;

type Elevation = { elevation: number } | { boxShadow: string };

function shadow(androidElevation: number, iosShadow: string): Elevation {
  return Platform.OS === 'android' ? { elevation: androidElevation } : { boxShadow: iosShadow };
}

export const elevation = {
  card: shadow(2, '0px 1px 2px rgba(16,20,42,0.06), 0px 4px 12px rgba(16,20,42,0.06)'),
  sheet: shadow(9, '0px 12px 40px rgba(16,20,42,0.22)'),
  floating: shadow(6, '0px 10px 30px rgba(16,20,42,0.16)'),
} as const;

export const motion = {
  durationBase: 220,
  spring: { damping: 18, stiffness: 240, mass: 0.8 },
  shake: { distance: 8, swings: 3, durationMs: 300 },
  toastMs: 4000,
  toastWithActionMs: 8000,
} as const;

// Dynamic Type caps for chrome/titles at extreme scales (AX5 is 3.57x); accessibilityText marks stacked-layout threshold.
export const textScale = {
  largeTitleMax: 1.3,
  barTitleMax: 1.6,
  segmentMax: 1.6,
  fitMinScale: 0.5,
  tabLabelMax: 1.35,
  rowMax: 2.4,
  rowTitleMax: 2,
  accessibilityText: 1.7,
} as const;

export const pressed = { dim: 0.85, dimIcon: 0.7, scale: 0.97 } as const;

export const touchTarget = 44;

export const controlSize = {
  buttonLarge: 52,
  buttonMedium: 44,
  pinKey: 76,
  iconTile: 30,
} as const;
