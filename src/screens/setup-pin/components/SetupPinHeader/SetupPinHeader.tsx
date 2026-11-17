import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './SetupPinHeader.styles';

export type SetupPinHeaderProps = {
  /** Add a PIN for an existing key has no back and no step count. */
  keepsDocuments: boolean;
  /** Step 2 of 2: confirming the PIN. */
  confirming: boolean;
};

/** Back to the intro, and which of the two steps this is. */
export function SetupPinHeader({ keepsDocuments, confirming }: SetupPinHeaderProps) {
  return (
    <View style={styles.header}>
      {keepsDocuments ? (
        <View />
      ) : (
        <IconButton
          icon="back"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
        />
      )}
      {keepsDocuments ? null : (
        <Text variant="footnote" tone="secondary">
          {confirming ? t('onboarding.pin.step2') : t('onboarding.pin.step1')}
        </Text>
      )}
    </View>
  );
}
