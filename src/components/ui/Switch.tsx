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
 * The native switches draw "on" at the right whatever the app's direction:
 * a layout forced right to left (F17) does not reach them, as it does not
 * reach the SF Symbols (see Icon). Mirrored, "on" sits at the leading edge.
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
