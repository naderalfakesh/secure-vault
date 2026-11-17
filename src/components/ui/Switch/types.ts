export type SwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  /** Required unless the switch sits in a row that already names it. */
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};
