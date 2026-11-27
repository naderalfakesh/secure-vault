import type { IconName } from '../Icon';
import type { ROWS } from './constants';

export type PinKey = Exclude<(typeof ROWS)[number][number], 'bio'>;

export type PinPadProps = {
  onKey: (key: PinKey) => void;
  onBiometric?: () => void;
  biometricIcon?: IconName;
  biometricLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
};

export type PinPadMetrics = {
  key: number;
  rowGap: number;
  columnGap: number;
  compact: boolean;
};
