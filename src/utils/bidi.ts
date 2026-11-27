const FSI = '⁨';
const PDI = '⁩';
export const LRI = '⁦';
export { PDI };

// Native equivalent of <bdi>: isolates user text with Unicode FSI..PDI so mixed-script segments stay ordered.
export function isolate(text: string): string {
  if (text.startsWith(FSI) && text.endsWith(PDI)) return text;
  return `${FSI}${text}${PDI}`;
}
