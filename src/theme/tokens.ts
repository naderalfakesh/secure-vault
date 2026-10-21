import { Platform } from 'react-native';

/** 4-pt spacing scale (handover §3.3, unchanged). */
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

/** Screen margins: grouped content sits 16 from the edge, titles 20. */
export const layout = {
  screenMargin: 16,
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
  /** iOS sheets float 8 pt in from the screen edges. */
  sheet: 36,
  /** Android sheets are attached to the bottom edge. */
  sheetAttached: 28,
  toast: 18,
  pill: 999,
} as const;

/** iOS 26 sheets are inset from the screen edges; Android sheets are attached. */
export const sheetInset = Platform.OS === 'ios' ? 8 : 0;

type Elevation = { elevation: number } | { boxShadow: string };

function shadow(androidElevation: number, iosShadow: string): Elevation {
  return Platform.OS === 'android' ? { elevation: androidElevation } : { boxShadow: iosShadow };
}

/**
 * Elevation. iOS draws the layered box shadows from the design; Android uses
 * its own elevation (2 for cards, 9 for sheets and toasts).
 */
export const elevation = {
  card: shadow(2, '0px 1px 2px rgba(16,20,42,0.06), 0px 4px 12px rgba(16,20,42,0.06)'),
  sheet: shadow(9, '0px 12px 40px rgba(16,20,42,0.22)'),
  /** The floating tab bar and the scan button. */
  floating: shadow(6, '0px 10px 30px rgba(16,20,42,0.16)'),
} as const;

export const motion = {
  durationFast: 120,
  durationBase: 220,
  durationSlow: 360,
  spring: { damping: 18, stiffness: 240, mass: 0.8 },
  listStaggerMs: 40,
  /** Wrong-PIN shake: 3 swings of 8 pt over 300 ms, only without reduced motion. */
  shake: { distance: 8, swings: 3, durationMs: 300 },
  /** Toasts stay 4 s, or 8 s when they carry an action such as Undo. */
  toastMs: 4000,
  toastWithActionMs: 8000,
} as const;

/** Minimum hit target on both platforms. */
export const touchTarget = 44;

/** Fixed control sizes from the design. */
export const controlSize = {
  buttonLarge: 52,
  buttonMedium: 44,
  pinKey: 76,
  iconTile: 30,
} as const;

/** Icon grid: 24-pt glyphs drawn as 1.75 outline strokes with round caps. */
export const iconography = {
  size: 24,
  small: 20,
  stroke: 1.75,
} as const;
