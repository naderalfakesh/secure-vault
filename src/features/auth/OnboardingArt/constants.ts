import type { Layer } from './types';

/** The illustrations share one 320 × 240 canvas. */
export const VIEW_BOX = '0 0 320 240';

/** Back first, then front: the order the layers rise in. */
export const LAYERS: readonly Layer[] = ['back', 'front'];

/** A circle on the canvas. */
type CircleGeometry = { cx: number; cy: number; r: number };

/** The muted disc every scene sits on, a little below the canvas centre. */
export const BACKDROP_DISC: CircleGeometry = { cx: 160, cy: 122, r: 104 };
/** The dots scattered around the disc. */
export const BACKDROP_DOTS: readonly CircleGeometry[] = [
  { cx: 52, cy: 58, r: 5 },
  { cx: 278, cy: 70, r: 8 },
  { cx: 268, cy: 196, r: 4 },
];

/** The navy the shadows are drawn in. */
export const SHADOW_INK = '#0A0F2E';
/** The seal's own contact shadow. */
export const SEAL_SHADOW_OPACITY = 0.12;
/** The soft floor shadow under each scene. */
export const FLOOR_OPACITY = 0.08;

/** The seal's radius in the app icon, which its parts are measured against. */
export const SEAL_UNIT = 132;

/** Reduce Motion: the layers only fade in. */
export const FADE_MS = 200;
/** Each layer rises in this long, on a spring. */
export const RISE_MS = 520;
export const RISE_DAMPING = 18;
/** The front layer follows the back one by this much. */
export const LAYER_STAGGER_MS = 120;
