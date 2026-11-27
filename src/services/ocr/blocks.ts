import type { RecognizedLine } from '@modules/expo-document-ai';

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

const firstBox = (draft: Draft): Box => draft.lines[0]?.box ?? draft.box;

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

function readingOrder(a: Box, b: Box): number {
  const tolerance = Math.min(heightOf(a), heightOf(b)) / 2;
  return Math.abs(a.top - b.top) < tolerance ? a.left - b.left : a.top - b.top;
}

function continuation(last: Box, line: Box): number | null {
  const height = Math.max(heightOf(last), heightOf(line));
  const gap = line.top - last.bottom;
  if (gap < -height / 2 || gap > height) return null;
  const overlap = Math.min(last.right, line.right) - Math.max(last.left, line.left);
  if (overlap > 0 || Math.abs(line.left - last.left) < height) return Math.max(overlap, 0);
  return null;
}

// Groups Vision lines into column-preserving ML-Kit-style blocks in reading order.
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
      const tail = draft.lines.at(-1);
      if (!tail) continue;
      const overlap = continuation(tail.box, line.box);
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
    .sort((a, b) => readingOrder(firstBox(a), firstBox(b)))
    .map((draft) => ({
      text: draft.lines.map((line) => line.text).join('\n'),
      lines: draft.lines.map((line) => line.text),
      boundingBox: draft.box,
    }));
}
