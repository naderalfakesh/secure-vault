import type { RecognizedLine } from '../../../modules/expo-document-ai';
import type { OcrBlock } from './types';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Line {
  text: string;
  box: Box;
}

interface Draft {
  lines: Line[];
  box: Box;
}

function toLine({ text, frame }: RecognizedLine): Line {
  return {
    text,
    box: {
      left: frame.left,
      top: frame.top,
      right: frame.left + frame.width,
      bottom: frame.top + frame.height,
    },
  };
}

const heightOf = (box: Box) => box.bottom - box.top;

/** Top to bottom; boxes whose tops are within half a line count as one row, left to right. */
function readingOrder(a: Box, b: Box): number {
  const tolerance = Math.min(heightOf(a), heightOf(b)) / 2;
  return Math.abs(a.top - b.top) < tolerance ? a.left - b.left : a.top - b.top;
}

/**
 * How well `line` continues a block whose last line is `last`: it must start
 * at most one line height below it (not beside it) and share its column, by
 * overlapping it or starting within a line height of its left edge. Returns
 * the horizontal overlap, or null when it does not continue the block.
 */
function continuation(last: Box, line: Box): number | null {
  const height = Math.max(heightOf(last), heightOf(line));
  const gap = line.top - last.bottom;
  if (gap < -height / 2 || gap > height) return null;
  const overlap = Math.min(last.right, line.right) - Math.max(last.left, line.left);
  if (overlap > 0 || Math.abs(line.left - last.left) < height) return Math.max(overlap, 0);
  return null;
}

/**
 * Groups recognised lines into blocks the way ML Kit reports them: a label
 * and the value under it ("Date of expiry", "12 MAR 2030") stay together, and
 * two columns stay apart instead of interleaving row by row. Blocks come back
 * in reading order, each line in its block top to bottom.
 */
export function groupLines(recognized: RecognizedLine[]): OcrBlock[] {
  const lines = recognized
    .filter((line) => line.text.trim() !== '')
    .map(toLine)
    .sort((a, b) => readingOrder(a.box, b.box));

  const drafts: Draft[] = [];
  for (const line of lines) {
    let best: Draft | undefined;
    let bestOverlap = -1;
    for (const draft of drafts) {
      const overlap = continuation(draft.lines[draft.lines.length - 1].box, line.box);
      if (overlap !== null && overlap > bestOverlap) {
        best = draft;
        bestOverlap = overlap;
      }
    }
    if (best) {
      best.lines.push(line);
      best.box = {
        left: Math.min(best.box.left, line.box.left),
        top: Math.min(best.box.top, line.box.top),
        right: Math.max(best.box.right, line.box.right),
        bottom: Math.max(best.box.bottom, line.box.bottom),
      };
    } else {
      drafts.push({ lines: [line], box: { ...line.box } });
    }
  }

  return drafts
    .sort((a, b) => readingOrder(a.lines[0].box, b.lines[0].box))
    .map((draft) => ({
      text: draft.lines.map((line) => line.text).join('\n'),
      lines: draft.lines.map((line) => line.text),
      boundingBox: draft.box,
    }));
}
