import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';
import { estimatePassphraseStrength } from '@/utils/passphraseStrength';

import { Text } from '../Text';
import { levelColor, SEGMENTS, TRACK } from './constants';
import { styles } from './StrengthMeter.styles';
import type { StrengthMeterProps } from './types';

export function StrengthMeter({ passphrase, testID }: StrengthMeterProps) {
  const { theme } = useUnistyles();
  const strength = estimatePassphraseStrength(passphrase);
  const label = strength === 0 ? '' : t(`ui.strength.${strength}`);
  const color = theme.colors[levelColor[strength]];

  return (
    <View
      accessible={strength > 0}
      accessibilityLabel={label ? t('ui.strength.label', { level: label }) : undefined}
      accessibilityLiveRegion="polite"
      style={styles.row}
      testID={testID}
    >
      <View style={styles.segments}>
        {SEGMENTS.map((segment) => (
          <View
            key={segment}
            testID={`strength-segment-${segment}`}
            style={[
              styles.segment,
              { backgroundColor: segment <= strength ? color : theme.colors[TRACK] },
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
