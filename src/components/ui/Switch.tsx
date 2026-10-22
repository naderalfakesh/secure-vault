import { I18nManager, Platform, Switch as NativeSwitch, type ViewStyle } from 'react-native';
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
 * Right to left, each switch follows its platform's own convention (F6):
 * - iOS: UISwitch mirrors itself from the view's semantic content attribute,
 *   which React Native sets from the layout direction, so "on" sits at the
 *   left. It gets no transform: a second flip would undo the native one.
 * - Android: Material puts "on" at the end, the left in RTL. The native
 *   switch does not take the layout direction from React Native, so it is
 *   mirrored here, once.
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
      style={I18nManager.isRTL && Platform.OS !== 'ios' ? mirrored : undefined}
    />
  );
}
