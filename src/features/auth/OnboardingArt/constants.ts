import type { Layer } from './types';

export const VIEW_BOX = '0 0 320 240';

export const LAYERS: readonly Layer[] = ['back', 'front'];

type CircleGeometry = { cx: number; cy: number; r: number };

export const BACKDROP_DISC: CircleGeometry = { cx: 160, cy: 122, r: 104 };
export const BACKDROP_DOTS: readonly CircleGeometry[] = [
  { cx: 52, cy: 58, r: 5 },
  { cx: 278, cy: 70, r: 8 },
  { cx: 268, cy: 196, r: 4 },
];

export const SHADOW_INK = '#0A0F2E';
export const SEAL_SHADOW_OPACITY = 0.12;
export const FLOOR_OPACITY = 0.08;

export const SEAL_UNIT = 132;

export const FADE_MS = 200;
export const RISE_MS = 520;
export const RISE_DAMPING = 18;
export const LAYER_STAGGER_MS = 120;
