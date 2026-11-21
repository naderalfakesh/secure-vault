import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './SetupPinHeader.styles';

type SetupPinHeaderProps = {
  /** Add a PIN for an existing key has no back and no step count. */
  keepsDocuments: boolean;
  /** Step 2 of 2: confirming the PIN. */
  confirming: boolean;
};

/** Back on the left, "Step n of 2" in the middle, as Change PIN lays out its steps. */
export function SetupPinHeader({ keepsDocuments, confirming }: SetupPinHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {keepsDocuments ? null : (
          <IconButton
            icon="back"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
          />
        )}
      </View>
      {keepsDocuments ? null : (
        <Text variant="subheadline" tone="secondary" style={styles.step}>
          {confirming ? t('onboarding.pin.step2') : t('onboarding.pin.step1')}
        </Text>
      )}
      <View style={styles.side} />
    </View>
  );
}
