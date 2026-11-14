import { I18nManager, Switch as NativeSwitch, type ViewStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type SwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  /** Required unless the switch sits in a row that already names it. */
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

/**
 * Right to left, "on" sits at the left on both platforms. Neither native
 * switch takes the direction from React Native in this app: Android's ignores
 * it, and on iOS a layout forced right to left does not reach UISwitch,
 * as it does not reach the SF Symbols (see Icon). QA on iOS 27 showed "on" at
 * the right without this flip, so both are mirrored here, once.
 */
const mirrored: ViewStyle = { transform: [{ scaleX: -1 }] };

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
      style={I18nManager.isRTL ? mirrored : undefined}
    />
  );
}
