import { View } from 'react-native';

import { decorative } from '../a11y';
import { Icon } from '../Icon';
import { Switch } from '../Switch';
import type { ListRowAccessoryProps } from './types';

export function ListRowAccessory({
  trailing,
  toggle,
  checked,
  pressable,
  destructive,
  disabled,
  testID,
}: ListRowAccessoryProps) {
  if (trailing !== undefined) return <>{trailing}</>;
  if (toggle) {
    // Row owns the accessible switch role; hiding the native switch avoids a duplicate focus stop and double-toggle.
    return (
      <View {...decorative} pointerEvents="none">
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          disabled={disabled}
          testID={testID ? `${testID}-switch` : 'list-row-switch'}
        />
      </View>
    );
  }
  if (checked !== undefined) {
    return checked ? <Icon name="check" size={18} tone="accent" /> : null;
  }
  if (pressable && !destructive) {
    return <Icon name="chevronRight" size={18} tone="tertiary" />;
  }
  return null;
}
