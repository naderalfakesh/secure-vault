import { Switch as NativeSwitch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type SwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  /** Required unless the switch sits in a row that already names it. */
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

/** Platform switch; "on" is the success colour in both themes. */
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
  testID,
}: SwitchProps) {
  const { theme } = useUnistyles();

  return (
    <NativeSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), checked: value }}
      testID={testID}
      trackColor={{ true: theme.colors.success, false: theme.colors.borderStrong }}
      ios_backgroundColor={theme.colors.borderStrong}
      thumbColor="#FFFFFF"
    />
  );
}
