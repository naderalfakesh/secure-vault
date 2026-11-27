import { View } from 'react-native';

import { t } from '@/i18n';

import { decorative } from '../a11y';
import { Mark } from '../Mark';
import { Text } from '../Text';
import { styles } from './PrivacyCover.styles';

export function PrivacyCover() {
  return (
    <View style={styles.cover} pointerEvents="none" {...decorative} testID="privacy-cover">
      <Mark size={80} />
      <Text variant="headline">{t('common.appName')}</Text>
    </View>
  );
}
