import { Children, type ReactNode } from 'react';

import { textScale } from '@/theme/tokens';

export function plainText(children: ReactNode): string | null {
  let text = '';
  for (const child of Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number') text += String(child);
    else return null;
  }
  return text;
}

// Caps numberOfLines to word count + adjustsFontSizeToFit so long words shrink instead of splitting mid-word at AX5.
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
