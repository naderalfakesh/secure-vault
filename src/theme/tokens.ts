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

export const radii = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#0B0F1E',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0B0F1E',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  lg: {
    shadowColor: '#0B0F1E',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
} as const;

export const motion = {
  durationFast: 120,
  durationBase: 220,
  durationSlow: 360,
  spring: { damping: 18, stiffness: 240, mass: 0.8 },
  listStaggerMs: 40,
} as const;

/** Minimum hit target on both platforms. */
export const touchTarget = 44;
