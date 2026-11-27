import { GLYPH_SIZES } from './constants';

export function markGlyphSize(size: number): number {
  return GLYPH_SIZES[size] ?? Math.round(size * 0.6);
}
