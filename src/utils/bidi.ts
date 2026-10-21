/** First strong isolate and pop directional isolate (Unicode bidi controls). */
const FSI = '⁨';
const PDI = '⁩';
/** Left-to-right isolate; closed by the same PDI. */
export const LRI = '⁦';
export { PDI };

/**
 * Wraps user text such as a file name or document title so its direction
 * cannot reorder the text around it: "عقد الإيجار 2026.pdf · 3 pages" keeps
 * its parts in order in both layouts. This is the native stand-in for `<bdi>`.
 */
export function isolate(text: string): string {
  if (text.startsWith(FSI) && text.endsWith(PDI)) return text;
  return `${FSI}${text}${PDI}`;
}
