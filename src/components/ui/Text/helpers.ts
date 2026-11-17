import { Children, type ReactNode } from 'react';

import { textScale } from '@/theme/tokens';

/** The plain text of `children`, or null when it holds anything but text. */
export function plainText(children: ReactNode): string | null {
  let text = '';
  for (const child of Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number') text += String(child);
    else return null;
  }
  return text;
}

/**
 * Props that keep every word of `text` whole. Wrapping alone breaks a
 * word that is wider than the line ("Libra/ry" at AX5), so the text gets one
 * line per word at most and `adjustsFontSizeToFit` shrinks it until it fits
 * them: a word broken across lines would need more lines than that. Null for
 * empty text.
 */
export function wholeWordFit(
  text: string,
  numberOfLines?: number,
): { numberOfLines: number; adjustsFontSizeToFit: true; minimumFontScale: number } | null {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  if (words === 0) return null;
  return {
    numberOfLines: numberOfLines ?? words,
    adjustsFontSizeToFit: true,
    minimumFontScale: textScale.fitMinScale,
  };
}
