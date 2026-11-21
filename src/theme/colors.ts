/**
 * SecureVault palette. Indigo carries trust and the
 * locked state, brass marks only what needs attention (expiry, warnings, the
 * point of no return), and the neutrals stay slightly cool so scanned paper
 * reads as the warmest thing on screen. Every text/background pair is AA in
 * both modes.
 */
const light = {
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EDEFF5',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#10142A',
  textSecondary: '#4A5270',
  textTertiary: '#646C88',
  border: '#DDE1EC',
  borderStrong: '#C4CADB',
  primary: '#3451D1',
  primaryMuted: '#E6EAFD',
  onPrimary: '#FFFFFF',
  accent: '#8F5E07',
  accentMuted: '#FBF0D9',
  warning: '#8F5E07',
  warningMuted: '#FBF0D9',
  success: '#14774A',
  successMuted: '#DFF3E8',
  onSuccess: '#FFFFFF',
  danger: '#C2324B',
  dangerMuted: '#FCE5E9',
  onDanger: '#FFFFFF',
  paper: '#FBFAF6',
  viewerStage: '#0B0D14',
  scrim: 'rgba(16,20,42,0.32)',
  toastBg: '#1A2036',
  toastText: '#F1F3FA',
  toastAction: '#8EA2FF',
  toastDangerBg: '#45182A',
  toastDangerText: '#FFE3E8',
  toastDangerIcon: '#FF7D92',
  skeletonBase: '#EDEFF5',
};

/** The one list of colour names: both palettes are checked against it. */
export type ColorName = keyof typeof light;
export type Palette = Record<ColorName, string>;

export const lightColors: Palette = light;

export const darkColors: Palette = {
  background: '#0A0D1A',
  surface: '#131829',
  surfaceMuted: '#1C2239',
  surfaceElevated: '#1A2036',
  textPrimary: '#F1F3FA',
  textSecondary: '#B3BAD1',
  textTertiary: '#8D95B0',
  border: '#262D49',
  borderStrong: '#38405F',
  primary: '#8EA2FF',
  primaryMuted: '#1D2858',
  onPrimary: '#0A0F2E',
  accent: '#EDB54C',
  accentMuted: '#3A2C0E',
  warning: '#EDB54C',
  warningMuted: '#3A2C0E',
  success: '#4FD08E',
  successMuted: '#10351F',
  onSuccess: '#04170C',
  danger: '#FF7D92',
  dangerMuted: '#45182A',
  // Text on a danger fill is dark in dark mode, not white.
  onDanger: '#2A0710',
  paper: '#F3F1EA',
  viewerStage: '#0B0D14',
  scrim: 'rgba(0,0,0,0.55)',
  toastBg: '#1A2036',
  toastText: '#F1F3FA',
  toastAction: '#8EA2FF',
  toastDangerBg: '#45182A',
  toastDangerText: '#FFE3E8',
  toastDangerIcon: '#FF7D92',
  skeletonBase: '#1C2239',
};
