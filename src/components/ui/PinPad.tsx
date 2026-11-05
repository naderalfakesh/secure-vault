import { Pressable, useWindowDimensions, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@/i18n';
import { displayDigit } from '@/i18n/digits';
import { controlSize } from '@/theme/tokens';

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

export type PinPadMetrics = {
  /** Round key size; never under the 44 pt touch target. */
  key: number;
  rowGap: number;
  columnGap: number;
  /** A short window: PIN screens tighten the space above their dots too. */
  compact: boolean;
};

/**
 * Keypad size for a window height. The design's 76 pt keys fit a regular
 * phone; on short windows (a 411 × 648 dp Android phone, split screen) the
 * keys and gaps step down so the pad never covers the title and the dots.
 * The smallest step stays well above the 44 pt minimum target.
 */
export function pinPadMetrics(windowHeight: number): PinPadMetrics {
  if (windowHeight >= 780)
    return { key: controlSize.pinKey, rowGap: 16, columnGap: 26, compact: false };
  if (windowHeight >= 700) return { key: 68, rowGap: 12, columnGap: 24, compact: true };
  if (windowHeight >= 620) return { key: 60, rowGap: 10, columnGap: 22, compact: true };
  return { key: 52, rowGap: 8, columnGap: 20, compact: true };
}

/** The keypad metrics for the current window. */
export function usePinPadMetrics(): PinPadMetrics {
  const { height } = useWindowDimensions();
  return pinPadMetrics(height);
}

/**
 * 3 × 4 PIN keypad: 76 pt round keys (smaller on short windows), the biometric key bottom
 * start, backspace bottom end. Digits never mirror in right-to-left layouts.
 */
export function PinPad({
  onKey,
  onBiometric,
  biometricIcon = 'faceId',
  biometricLabel = t('ui.pinPad.biometric'),
  disabled = false,
  busy = false,
}: PinPadProps) {
  const blocked = disabled || busy;
  const metrics = usePinPadMetrics();
  return (
    <View
      style={[styles.pad, { gap: metrics.rowGap }, disabled && styles.disabled]}
      testID="pin-pad"
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
                  // Digits grow with the text size only as far as the key holds them.
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

const styles = StyleSheet.create((theme) => ({
  pad: {
    alignSelf: 'center',
    direction: 'ltr',
  },
  row: {
    flexDirection: 'row',
  },
  key: (action: boolean, size: number) => ({
    width: size,
    height: size,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: action ? 'transparent' : theme.colors.surfaceMuted,
  }),
  pressed: (action: boolean) => ({
    backgroundColor: action ? theme.colors.surfaceMuted : theme.colors.borderStrong,
  }),
  disabled: { opacity: 0.32 },
}));
