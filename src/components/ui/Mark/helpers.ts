import { GLYPH_SIZES } from './constants';

/** The outline glyph size inside a tile of this size. */
export function markGlyphSize(size: number): number {
  return GLYPH_SIZES[size] ?? Math.round(size * 0.6);
}
