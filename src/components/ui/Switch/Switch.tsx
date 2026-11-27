import { I18nManager, Switch as NativeSwitch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { MIRRORED } from './constants';
import type { SwitchProps } from './types';

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
      thumbColor={theme.colors.switchThumb}
      style={I18nManager.isRTL ? MIRRORED : undefined}
    />
  );
}
