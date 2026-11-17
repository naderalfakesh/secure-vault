export type ProgressBlockProps = {
  /** "Verb X of N", e.g. "Checking 18 of 48". */
  label: string;
  /** Optional right-hand text: a percentage or "Step 1 of 2". */
  detail?: string;
  /** 0 to 1. */
  progress: number;
  testID?: string;
};
