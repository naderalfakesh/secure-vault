export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Spoken name of the whole control, e.g. "Appearance". */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};
