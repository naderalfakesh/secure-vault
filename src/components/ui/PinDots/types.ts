export type PinDotsProps = {
  count?: number;
  filled: number;
  /** Wrong PIN: every dot turns danger. Pair it with text; colour never speaks alone. */
  error?: boolean;
  /** Increment to play the shake. Reduced motion skips it. */
  shake?: number;
  testID?: string;
};
