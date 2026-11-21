import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './StepBar.styles';
import { STEPS, TOTAL_STEPS } from '../../constants';
import type { Stage } from '../../types';

type StepBarProps = {
  stage: Stage;
};

/** Cancel on the left, "Step n of 3" in the middle. */
export function StepBar({ stage }: StepBarProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.cancel}>
        <Button
          label={t('common.cancel')}
          accessibilityHint={t('changePin.cancelHint')}
          variant="plain"
          size="md"
          onPress={() => router.back()}
          disabled={stage === 'saving'}
        />
      </View>
      <Text variant="subheadline" tone="secondary" style={styles.step}>
        {t('changePin.step', { step: STEPS[stage], total: TOTAL_STEPS })}
      </Text>
      <View style={styles.cancel} />
    </View>
  );
}
