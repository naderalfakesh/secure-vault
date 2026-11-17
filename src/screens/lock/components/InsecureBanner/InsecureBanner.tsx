import { ScrollView, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { t } from '@/i18n';

import { styles } from './InsecureBanner.styles';

/** A warning, never a block: the device's security checks did not pass. */
export function InsecureBanner() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.bannerArea}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.banner} accessibilityRole="alert">
        <Icon name="warning" size={16} tone="warning" />
        <Text variant="caption" tone="secondary" style={styles.bannerText}>
          {t('lock.insecureDevice')}
        </Text>
      </View>
    </ScrollView>
  );
}
