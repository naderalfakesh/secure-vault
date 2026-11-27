import { View } from 'react-native';

import { Icon } from '@/components/ui';

import { styles } from './KeyBadge.styles';

export function KeyBadge() {
  return (
    <View style={styles.badge}>
      <Icon name="key" size={28} tone="inverse" />
    </View>
  );
}
