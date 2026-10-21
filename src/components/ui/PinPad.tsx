import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type PinPadProps = {
  /** Called with a digit, or with "del" for the backspace key. */
  onKey: (key: string) => void;
  /** Omit when biometrics are unavailable; the key is then hidden. */
  onBiometric?: () => void;
  biometricIcon?: IconName;
  biometricLabel?: string;
  /** Lockout or busy: the pad dims to 32% and ignores presses. */
  disabled?: boolean;
  /** A PIN check is running: presses are ignored, but the pad keeps its look. */
  busy?: boolean;
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['bio', '0', 'del'],
] as const;

/**
 * 3 × 4 PIN keypad (handover §4): 76 pt round keys, the biometric key bottom
 * start, backspace bottom end. Digits never mirror in right-to-left layouts.
 */
export function PinPad({
  onKey,
  onBiometric,
  biometricIcon = 'faceId',
  biometricLabel = 'Use biometrics',
  disabled = false,
  busy = false,
}: PinPadProps) {
  const blocked = disabled || busy;
  return (
    <View style={[styles.pad, disabled && styles.disabled]} testID="pin-pad">
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => {
            if (key === 'bio' && !onBiometric) return <View key={key} style={styles.spacer} />;
            const action = key === 'bio' || key === 'del';
            const label = key === 'del' ? 'Delete' : key === 'bio' ? biometricLabel : key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ disabled, busy }}
                disabled={blocked}
                onPress={() => (key === 'bio' ? onBiometric?.() : onKey(key))}
                style={({ pressed }) => [styles.key(action), pressed && styles.pressed(action)]}
              >
                {key === 'del' ? (
                  <Icon name="backspace" size={26} />
                ) : key === 'bio' ? (
                  <Icon name={biometricIcon} size={30} tone="accent" />
                ) : (
                  <Text variant="pinDigit">{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  pad: {
    alignSelf: 'center',
    gap: theme.spacing.md,
    direction: 'ltr',
  },
  row: {
    flexDirection: 'row',
    gap: 26,
  },
  key: (action: boolean) => ({
    width: theme.controlSize.pinKey,
    height: theme.controlSize.pinKey,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: action ? 'transparent' : theme.colors.surfaceMuted,
  }),
  pressed: (action: boolean) => ({
    backgroundColor: action ? theme.colors.surfaceMuted : theme.colors.borderStrong,
  }),
  spacer: {
    width: theme.controlSize.pinKey,
    height: theme.controlSize.pinKey,
  },
  disabled: { opacity: 0.32 },
}));
