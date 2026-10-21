import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Palette } from '@/theme/colors';
import {
  estimatePassphraseStrength,
  type PassphraseStrength,
  STRENGTH_LABELS,
} from '@/utils/passphraseStrength';

import { Text } from './Text';

export type StrengthMeterProps = {
  passphrase: string;
  testID?: string;
};

const levelColor: Record<PassphraseStrength, keyof Palette> = {
  0: 'surfaceMuted',
  1: 'danger',
  2: 'warning',
  3: 'success',
  4: 'success',
};

/** Four-segment passphrase strength (handover §4). An on-device estimate, never a rule. */
export function StrengthMeter({ passphrase, testID }: StrengthMeterProps) {
  const { theme } = useUnistyles();
  const strength = estimatePassphraseStrength(passphrase);
  const label = STRENGTH_LABELS[strength];
  const color = theme.colors[levelColor[strength]];

  return (
    <View
      accessible={strength > 0}
      accessibilityLabel={label ? `Passphrase strength: ${label}` : undefined}
      accessibilityLiveRegion="polite"
      style={styles.row}
      testID={testID}
    >
      <View style={styles.segments}>
        {[1, 2, 3, 4].map((segment) => (
          <View
            key={segment}
            testID={`strength-segment-${segment}`}
            style={[
              styles.segment,
              { backgroundColor: segment <= strength ? color : theme.colors.surfaceMuted },
            ]}
          />
        ))}
      </View>
      {label ? (
        <Text variant="footnote" style={[styles.label, { color }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 18,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.xxs,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontWeight: '600',
  },
}));
