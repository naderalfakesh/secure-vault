import { I18nManager, Switch as NativeSwitch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { MIRRORED, THUMB_COLOR } from './constants';
import type { SwitchProps } from './types';

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
      thumbColor={THUMB_COLOR}
      style={I18nManager.isRTL ? MIRRORED : undefined}
    />
  );
}
