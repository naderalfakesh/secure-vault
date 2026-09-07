/**
 * SecureVault palette. Indigo carries trust and the locked state, brass marks
 * anything that needs attention (expiring documents, warnings), and the
 * neutrals stay slightly cool so scanned paper reads as the warmest thing on
 * screen.
 */
export const lightColors = {
  primary: '#3B5BDB',
  primaryMuted: '#E3E9FF',
  onPrimary: '#FFFFFF',
  accent: '#C98A11',
  accentMuted: '#FBEFD2',
  success: '#1F9D62',
  successMuted: '#DDF5E8',
  warning: '#C98A11',
  warningMuted: '#FBEFD2',
  danger: '#D6455D',
  dangerMuted: '#FBE3E8',
  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EBEFF7',
  textPrimary: '#141A2E',
  textSecondary: '#4A5473',
  textTertiary: '#7C86A3',
  textInverse: '#FFFFFF',
  border: '#D9DFEC',
  borderStrong: '#B9C2D8',
  skeletonBase: '#E2E7F2',
  skeletonHighlight: '#F4F6FB',
  overlay: 'rgba(20, 26, 46, 0.55)',
  scrim: 'rgba(20, 26, 46, 0.18)',
} as const;

export const darkColors = {
  primary: '#8AA0FF',
  primaryMuted: '#1E2A5C',
  onPrimary: '#0B1030',
  accent: '#F0B84A',
  accentMuted: '#3D2E0C',
  success: '#4CD48F',
  successMuted: '#123B27',
  warning: '#F0B84A',
  warningMuted: '#3D2E0C',
  danger: '#FF7A90',
  dangerMuted: '#4A1C27',
  background: '#0B0F1E',
  surface: '#141A2E',
  surfaceElevated: '#1B2340',
  surfaceMuted: '#1F2745',
  textPrimary: '#F2F4FA',
  textSecondary: '#B4BBD2',
  textTertiary: '#7C86A3',
  textInverse: '#0B0F1E',
  border: '#2A3352',
  borderStrong: '#3B4569',
  skeletonBase: '#1F2745',
  skeletonHighlight: '#2A3352',
  overlay: 'rgba(3, 6, 18, 0.7)',
  scrim: 'rgba(3, 6, 18, 0.4)',
} as const;

export type ColorName = keyof typeof lightColors;
