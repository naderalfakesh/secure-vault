import { createElement } from 'react';

import { buttonFill, isPlainVariant } from '../Button/helpers';
import { rowLabel, rowTint } from '../ListRow/helpers';
import { markGlyphSize } from '../Mark/helpers';
import { progressPercent } from '../ProgressBlock/helpers';
import { plainText } from '../Text/helpers';

describe('buttonFill', () => {
  it('uses the variant colours when enabled or busy', () => {
    expect(buttonFill('primary', false, false)).toEqual({
      background: 'primary',
      foreground: 'onPrimary',
    });
    expect(buttonFill('destructive', true, true)).toEqual({
      background: 'danger',
      foreground: 'onDanger',
    });
  });

  it('greys a disabled button, keeping a text button unfilled', () => {
    expect(buttonFill('tinted', true, false)).toEqual({
      background: 'surfaceMuted',
      foreground: 'textTertiary',
    });
    expect(buttonFill('plainDestructive', true, false)).toEqual({
      background: 'transparent',
      foreground: 'textTertiary',
    });
  });

  it('treats only the text variants as plain', () => {
    expect(isPlainVariant('plain')).toBe(true);
    expect(isPlainVariant('plainDestructive')).toBe(true);
    expect(isPlainVariant('secondary')).toBe(false);
  });
});

describe('rowTint', () => {
  it('prefers the explicit tint', () => {
    expect(rowTint('success', true)).toBe('success');
  });

  it('falls back to danger, then primary', () => {
    expect(rowTint(undefined, true)).toBe('danger');
    expect(rowTint(undefined, false)).toBe('primary');
  });
});

describe('rowLabel', () => {
  it('joins the title, value and subtitle that are present', () => {
    expect(rowLabel('Auto-lock', 'After 1 minute', 'Locks the vault')).toBe(
      'Auto-lock, After 1 minute, Locks the vault',
    );
    expect(rowLabel('Version')).toBe('Version');
  });
});

describe('markGlyphSize', () => {
  it('uses the design sizes and scales any other tile', () => {
    expect(markGlyphSize(64)).toBe(38);
    expect(markGlyphSize(80)).toBe(46);
    expect(markGlyphSize(100)).toBe(60);
  });
});

describe('progressPercent', () => {
  it('rounds to a whole percent and clamps', () => {
    expect(progressPercent(0.375)).toBe(38);
    expect(progressPercent(-1)).toBe(0);
    expect(progressPercent(2)).toBe(100);
    expect(progressPercent(Number.NaN)).toBe(0);
  });
});

describe('plainText', () => {
  it('joins strings and numbers', () => {
    expect(plainText(['Step ', 2])).toBe('Step 2');
  });

  it('is null when the children hold an element', () => {
    expect(plainText(['a', createElement('b', { key: 'b' })])).toBeNull();
  });
});
