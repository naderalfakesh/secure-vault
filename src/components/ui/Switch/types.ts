export type SwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};
