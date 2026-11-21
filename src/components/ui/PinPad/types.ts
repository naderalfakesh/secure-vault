import type { IconName } from '../Icon';
import type { ROWS } from './constants';

/** A digit, or "del" for the backspace key. */
export type PinKey = Exclude<(typeof ROWS)[number][number], 'bio'>;

export type PinPadProps = {
  /** Called with a digit, or with "del" for the backspace key. */
  onKey: (key: PinKey) => void;
  /** Omit when biometrics are unavailable; the key is then hidden. */
  onBiometric?: () => void;
  biometricIcon?: IconName;
  biometricLabel?: string;
  /** Lockout or busy: the pad dims to 32% and ignores presses. */
  disabled?: boolean;
  /** A PIN check is running: presses are ignored, but the pad keeps its look. */
  busy?: boolean;
  /** Root id; defaults to "pin-pad". */
  testID?: string;
};

export type PinPadMetrics = {
  /** Round key size; never under the 44 pt touch target. */
  key: number;
  rowGap: number;
  columnGap: number;
  /** A short window: PIN screens tighten the space above their dots too. */
  compact: boolean;
};
