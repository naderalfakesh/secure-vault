import { only } from '@/testing/lists';
import type { RecognizedLine } from '@modules/expo-document-ai';

import { groupLines } from '../blocks';

const line = (
  text: string,
  left: number,
  top: number,
  width = 200,
  height = 20,
): RecognizedLine => ({
  text,
  frame: { left, top, width, height },
});

const texts = (lines: RecognizedLine[]) => groupLines(lines).map((block) => block.text);

describe('grouping Vision lines into blocks', () => {
  it('returns nothing for no lines', () => {
    expect(groupLines([])).toEqual([]);
  });

  it('keeps a label with the value under it and columns apart', () => {
    expect(
      texts([
        line('12 MAR 2030', 500, 331),
        line('Date of expiry', 500, 302),
        line('12 MAR 2020', 40, 330),
        line('Date of issue', 40, 300),
      ]),
    ).toEqual(['Date of issue\n12 MAR 2020', 'Date of expiry\n12 MAR 2030']);
  });

  it('starts a new block after a gap taller than a line', () => {
    expect(texts([line('Heading', 40, 0), line('Body text', 40, 80)])).toEqual([
      'Heading',
      'Body text',
    ]);
  });

  it('joins an indented line that still overlaps the one above', () => {
    expect(texts([line('Passport No.', 40, 0, 300), line('X1234567', 120, 24, 150)])).toEqual([
      'Passport No.\nX1234567',
    ]);
  });

  it('orders blocks top to bottom, and left to right within a row', () => {
    expect(
      texts([
        line('Right', 600, 101),
        line('Bottom', 40, 400),
        line('Left', 40, 100),
        line('Title', 40, 0),
      ]),
    ).toEqual(['Title', 'Left', 'Right', 'Bottom']);
  });

  it('skips blank lines', () => {
    expect(texts([line('  ', 40, 0), line('Text', 40, 30)])).toEqual(['Text']);
  });

  it('gives each block the box around its lines', () => {
    const block = only(groupLines([line('First', 40, 0, 100), line('Second line', 30, 22, 300)]));
    expect(block.boundingBox).toEqual({ left: 30, top: 0, right: 330, bottom: 42 });
    expect(block.lines).toEqual(['First', 'Second line']);
  });
});
