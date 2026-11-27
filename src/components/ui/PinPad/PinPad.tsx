import { Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { displayDigit } from '@/i18n/digits';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { ROWS } from './constants';
import { styles } from './PinPad.styles';
import type { PinPadProps } from './types';
import { usePinPadMetrics } from './usePinPadMetrics';

export function PinPad({
  onKey,
  onBiometric,
  biometricIcon = 'faceId',
  biometricLabel = t('ui.pinPad.biometric'),
  disabled = false,
  busy = false,
  testID = 'pin-pad',
}: PinPadProps) {
  const blocked = disabled || busy;
  const metrics = usePinPadMetrics();
  return (
    <View
      style={[styles.pad, { gap: metrics.rowGap }, disabled && styles.disabled]}
      testID={testID}
    >
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap: metrics.columnGap }]}>
          {row.map((key) => {
            if (key === 'bio' && !onBiometric) {
              return <View key={key} style={{ width: metrics.key, height: metrics.key }} />;
            }
            const action = key === 'bio' || key === 'del';
            const label =
              key === 'del' ? t('ui.pinPad.delete') : key === 'bio' ? biometricLabel : key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled, busy }}
                disabled={blocked}
                onPress={() => (key === 'bio' ? onBiometric?.() : onKey(key))}
                style={({ pressed }) => [
                  styles.key(action, metrics.key),
                  pressed && styles.pressed(action),
                ]}
              >
                {key === 'del' ? (
                  <Icon name="backspace" size={26} />
                ) : key === 'bio' ? (
                  <Icon name={biometricIcon} size={30} tone="accent" />
                ) : (
                  <Text variant="pinDigit" maxFontSizeMultiplier={1.3}>
                    {displayDigit(key)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
