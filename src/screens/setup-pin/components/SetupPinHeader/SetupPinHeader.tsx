import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './SetupPinHeader.styles';

type SetupPinHeaderProps = {
  keepsDocuments: boolean;
  confirming: boolean;
};

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
