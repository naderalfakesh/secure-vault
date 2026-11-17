import type { IconName } from '../Icon';

export type PinPadProps = {
  /** Called with a digit, or with "del" for the backspace key. */
  onKey: (key: string) => void;
  /** Omit when biometrics are unavailable; the key is then hidden. */
  onBiometric?: () => void;
  biometricIcon?: IconName;
  biometricLabel?: string;
  /** Lockout or busy: the pad dims to 32% and ignores presses. */
  disabled?: boolean;
  /** A PIN check is running: presses are ignored, but the pad keeps its look. */
  busy?: boolean;
};

export type PinPadMetrics = {
  /** Round key size; never under the 44 pt touch target. */
  key: number;
  rowGap: number;
  columnGap: number;
  /** A short window: PIN screens tighten the space above their dots too. */
  compact: boolean;
};
