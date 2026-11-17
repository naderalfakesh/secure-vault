import { View } from 'react-native';

import { Icon } from '@/components/ui';

import { styles } from './KeyBadge.styles';

/** The key above "Add a PIN", for a vault that keeps its documents. */
export function KeyBadge() {
  return (
    <View style={styles.badge}>
      <Icon name="key" size={28} tone="inverse" />
    </View>
  );
}
